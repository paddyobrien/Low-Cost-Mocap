import copy
import time
import cv2 as cv
import numpy as np
from scipy import linalg

from flask import Flask, Response, request
from flask_socketio import SocketIO
from flask_cors import CORS

from cameras import Cameras
from helpers import (
    camera_poses_to_serializable,
    calculate_reprojection_errors,
    bundle_adjustment,
    triangulate_points,
)

app = Flask(__name__)
CORS(app, supports_credentials=True)
socketio = SocketIO(app, cors_allowed_origins="*")
try:
    cameras = Cameras.instance()
except Exception as e:
    print(e)
    print("Failed to initialize cameras, check connections and try again")
    exit()

@app.route("/api/camera-stream")
def camera_stream():
    camera = request.args.get("camera")
    if camera is None:
        print("is none")
    else:
        camera = int(camera)
    cameras = Cameras.instance()
    cameras.set_socketio(socketio)

    def gen(cameras, camera):
        frequency = 150
        loop_interval = 1.0 / frequency
        last_run_time = 0
        i = 0

        while True:
            time_now = time.time()

            i = (i + 1) % 10
            if i == 0:
                socketio.emit("fps", {"fps": round(1 / (time_now - last_run_time))})

            if time_now - last_run_time < loop_interval:
                time.sleep(last_run_time - time_now + loop_interval)
            last_run_time = time.time()
            frames = cameras.get_frames(camera)
            jpeg_frame = cv.imencode(".jpg", frames)[1].tostring()

            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + jpeg_frame + b"\r\n"
            )

    return Response(
        gen(cameras, camera), mimetype="multipart/x-mixed-replace; boundary=frame"
    )


@socketio.on("acquire-floor")
def acquire_floor(data):
    cameras = Cameras.instance()
    object_points = data["objectPoints"]
    object_points = np.array([item for sublist in object_points for item in sublist])

    tmp_A = []
    tmp_b = []
    for i in range(len(object_points)):
        tmp_A.append([object_points[i, 0], object_points[i, 1], 1])
        tmp_b.append(object_points[i, 2])
    b = np.matrix(tmp_b).T
    A = np.matrix(tmp_A)

    fit, residual, rnk, s = linalg.lstsq(A, b)
    fit = fit.T[0]

    plane_normal = np.array([[fit[0]], [fit[1]], [-1]])
    plane_normal = plane_normal / linalg.norm(plane_normal)
    up_normal = np.array([[0], [0], [1]], dtype=np.float32)

    plane = np.array([fit[0], fit[1], -1, fit[2]])

    # https://math.stackexchange.com/a/897677/1012327
    G = np.array(
        [
            [
                np.dot(plane_normal.T, up_normal)[0][0],
                -linalg.norm(np.cross(plane_normal.T[0], up_normal.T[0])),
                0,
            ],
            [
                linalg.norm(np.cross(plane_normal.T[0], up_normal.T[0])),
                np.dot(plane_normal.T, up_normal)[0][0],
                0,
            ],
            [0, 0, 1],
        ]
    )
    F = np.array(
        [
            plane_normal.T[0],
            (
                (up_normal - np.dot(plane_normal.T, up_normal)[0][0] * plane_normal)
                / linalg.norm(
                    (up_normal - np.dot(plane_normal.T, up_normal)[0][0] * plane_normal)
                )
            ).T[0],
            np.cross(up_normal.T[0], plane_normal.T[0]),
        ]
    ).T
    R = F @ G @ linalg.inv(F)

    R = R @ [[1, 0, 0], [0, -1, 0], [0, 0, 1]]  # i dont fucking know why

    cameras.to_world_coords_matrix = np.array(
        np.vstack((np.c_[R, [0, 0, 0]], [[0, 0, 0, 1]]))
    )

    socketio.emit(
        "to-world-coords-matrix",
        {"to_world_coords_matrix": cameras.to_world_coords_matrix.tolist()},
    )


@socketio.on("set-origin")
def set_origin(data):
    cameras = Cameras.instance()
    object_point = np.array(data["objectPoint"])
    to_world_coords_matrix = np.array(data["toWorldCoordsMatrix"])
    transform_matrix = np.eye(4)

    object_point[1], object_point[2] = (
        object_point[2],
        object_point[1],
    )  # i dont fucking know why
    transform_matrix[:3, 3] = -object_point

    to_world_coords_matrix = transform_matrix @ to_world_coords_matrix
    cameras.to_world_coords_matrix = to_world_coords_matrix

    socketio.emit(
        "to-world-coords-matrix",
        {"to_world_coords_matrix": cameras.to_world_coords_matrix.tolist()},
    )


@socketio.on("update-camera-settings")
def change_camera_settings(data):
    cameras = Cameras.instance()

    cameras.edit_settings(data["exposure"], data["gain"])


@socketio.on("capture-points")
def capture_points(data):
    start_or_stop = data["startOrStop"]
    cameras = Cameras.instance()

    if start_or_stop == "start":
        cameras.start_capturing_points()
        return
    elif start_or_stop == "stop":
        cameras.stop_capturing_points()


@socketio.on("calculate-camera-pose")
def calculate_camera_pose(data):
    cameras = Cameras.instance()
    image_points = np.array(data["cameraPoints"])

    image_points_t = image_points.transpose((1, 0, 2))

    camera_poses = [{"R": np.eye(3), "t": np.array([[0], [0], [0]], dtype=np.float32)}]
    for camera_i in range(0, cameras.num_cameras - 1):
        camera1_image_points = image_points_t[camera_i]
        camera2_image_points = image_points_t[camera_i + 1]
        not_none_indicies = np.where(
            np.all(camera1_image_points != None, axis=1)
            & np.all(camera2_image_points != None, axis=1)
        )[0]
        camera1_image_points = np.take(
            camera1_image_points, not_none_indicies, axis=0
        ).astype(np.float32)
        camera2_image_points = np.take(
            camera2_image_points, not_none_indicies, axis=0
        ).astype(np.float32)

        F, _ = cv.findFundamentalMat(
            camera1_image_points, camera2_image_points, cv.FM_RANSAC, 3, 0.99999
        )
        if F is None:
            socketio.emit("error", "Could not compute fundamental matrix")
            return
        E = cv.sfm.essentialFromFundamental(
            F,
            cameras.get_camera_params(0)["intrinsic_matrix"],
            cameras.get_camera_params(1)["intrinsic_matrix"],
        )
        possible_Rs, possible_ts = cv.sfm.motionFromEssential(E)

        R = None
        t = None
        max_points_infront_of_camera = 0
        for i in range(0, 4):
            object_points = triangulate_points(
                np.hstack(
                    [
                        np.expand_dims(camera1_image_points, axis=1),
                        np.expand_dims(camera2_image_points, axis=1),
                    ]
                ),
                np.concatenate(
                    [[camera_poses[-1]], [{"R": possible_Rs[i], "t": possible_ts[i]}]]
                ),
            )
            object_points_camera_coordinate_frame = np.array(
                [possible_Rs[i].T @ object_point for object_point in object_points]
            )

            points_infront_of_camera = np.sum(object_points[:, 2] > 0) + np.sum(
                object_points_camera_coordinate_frame[:, 2] > 0
            )

            if points_infront_of_camera > max_points_infront_of_camera:
                max_points_infront_of_camera = points_infront_of_camera
                R = possible_Rs[i]
                t = possible_ts[i]

        R = R @ camera_poses[-1]["R"]
        t = camera_poses[-1]["t"] + (camera_poses[-1]["R"] @ t)

        camera_poses.append({"R": R, "t": t})

    camera_poses = bundle_adjustment(image_points, camera_poses)

    object_points = triangulate_points(image_points, camera_poses)
    error = np.mean(
        calculate_reprojection_errors(image_points, object_points, camera_poses)
    )

    cameras.set_camera_poses(cameras_poses)

    socketio.emit(
        "camera-pose", {"camera_poses": camera_poses_to_serializable(camera_poses)}
    )
    socketio.emit("success", f"Camera pose updated {error}")


@socketio.on("locate-objects")
def start_or_stop_locating_objects(data):
    cameras = Cameras.instance()
    start_or_stop = data["startOrStop"]

    if start_or_stop == "start":
        cameras.start_locating_objects()
        return
    elif start_or_stop == "stop":
        cameras.stop_locating_objects()


@socketio.on("determine-scale")
def determine_scale(data):
    object_points = data["objectPoints"]
    camera_poses = data["cameraPoses"]
    actual_distance = 0.085
    observed_distances = []

    for object_points_i in object_points:
        if len(object_points_i) != 2:
            continue

        object_points_i = np.array(object_points_i)

        observed_distances.append(
            np.sqrt(np.sum((object_points_i[0] - object_points_i[1]) ** 2))
        )

    scale_factor = actual_distance / np.mean(observed_distances)
    for i in range(0, len(camera_poses)):
        camera_poses[i]["t"] = (np.array(camera_poses[i]["t"]) * scale_factor).tolist()

    socketio.emit("camera-pose", {"error": None, "camera_poses": camera_poses})


@socketio.on("triangulate-points")
def live_mocap(data):
    cameras = Cameras.instance()
    start_or_stop = data["startOrStop"]
    camera_poses = data["cameraPoses"]
    cameras.to_world_coords_matrix = data["toWorldCoordsMatrix"]

    if start_or_stop == "start":
        cameras.start_trangulating_points(camera_poses)
        return
    elif start_or_stop == "stop":
        cameras.stop_trangulating_points()


if __name__ == "__main__":
    try:
        socketio.run(app, port=3001, debug=True, use_reloader=False)
    finally:
        print("\nReleasing cameras")
        cameras.end()
        print("\nGoodbye")
