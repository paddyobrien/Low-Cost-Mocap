import numpy as np
import cv2 as cv
from settings import intrinsic_matrix, distortion_coef
from pseyepy import Camera
from Singleton import Singleton
from KalmanFilter import KalmanFilter
from helpers import (
    find_point_correspondance_and_object_points,
    locate_objects,
    make_square,
)


@Singleton
class Cameras:
    def __init__(self):
        print("\nInitializing cameras")
        self.cameras = Camera(
            fps=90, resolution=Camera.RES_SMALL, colour=True, gain=1, exposure=100
        )
        self.num_cameras = len(self.cameras.exposure)
        print(f"\n{self.num_cameras} cameras found")

        self.is_capturing_points = True
        self.is_triangulating_points = False
        self.is_locating_objects = False

        self.camera_poses = None
        self.projection_matrices = None
        self.to_world_coords_matrix = None

        self.kalman_filter = KalmanFilter(1)
        self.socketio = None

    def end(self):
        self.cameras.end()

    def state(self):
        return {
            "is_capturing_points": self.is_capturing_points,
            "is_triangulating_points": self.is_triangulating_points,
            "is_locating_objects": self.is_locating_objects,
        }

    def set_socketio(self, socketio):
        self.socketio = socketio
        self.socketio.emit("num-cams", self.num_cameras)

    def set_camera_poses(self, poses):
        self.camera_poses = poses
        p = []
        for i, camera_pose in enumerate(self.camera_poses):
            RT = np.c_[camera_pose["R"], camera_pose["t"]]
            P = intrinsic_matrix @ RT
            p.append(P)
        self.projection_matrices = p

    def edit_settings(self, exposure, gain):
        self.cameras.exposure = [exposure] * self.num_cameras
        self.cameras.gain = [gain] * self.num_cameras

    def _camera_read(self):
        frames, _ = self.cameras.read(squeeze=False)

        for i in range(0, self.num_cameras):
            frames[i] = np.rot90(frames[i], k=0)
            frames[i] = make_square(frames[i])
            frames[i] = cv.undistort(frames[i], intrinsic_matrix, distortion_coef)
            # frames[i] = cv.medianBlur(frames[i],9)
            # frames[i] = cv.GaussianBlur(frames[i],(9,9),0)
            kernel = np.array(
                [
                    [-2, -1, -1, -1, -2],
                    [-1, 1, 3, 1, -1],
                    [-1, 3, 4, 3, -1],
                    [-1, 1, 3, 1, -1],
                    [-2, -1, -1, -1, -2],
                ]
            )
            frames[i] = cv.filter2D(frames[i], -1, kernel)
            frames[i] = cv.cvtColor(frames[i], cv.COLOR_RGB2BGR)

        if self.is_capturing_points:
            image_points = []
            for i in range(0, self.num_cameras):
                frames[i], single_camera_image_points = self._find_dot(frames[i])
                image_points.append(single_camera_image_points)

            if any(np.all(point[0] != [None, None]) for point in image_points):
                if self.is_capturing_points and not self.is_triangulating_points:
                    self.socketio.emit("image-points", [x[0] for x in image_points])
                elif self.is_triangulating_points:
                    errors, object_points, frames = (
                        find_point_correspondance_and_object_points(
                            image_points, self.camera_poses, frames
                        )
                    )

                    # convert to world coordinates
                    for i, object_point in enumerate(object_points):
                        new_object_point = (
                            np.array([[-1, 0, 0], [0, -1, 0], [0, 0, 1]]) @ object_point
                        )
                        new_object_point = np.concatenate((new_object_point, [1]))
                        new_object_point = (
                            np.array(self.to_world_coords_matrix) @ new_object_point
                        )
                        new_object_point = new_object_point[:3] / new_object_point[3]
                        new_object_point[1], new_object_point[2] = (
                            new_object_point[2],
                            new_object_point[1],
                        )
                        object_points[i] = new_object_point

                    objects = []
                    filtered_objects = []
                    if self.is_locating_objects:
                        objects = locate_objects(object_points, errors)
                        filtered_objects = self.kalman_filter.predict_location(objects)

                        if len(filtered_objects) != 0:
                            for filtered_object in filtered_objects:
                                filtered_object["heading"] = round(
                                    filtered_object["heading"], 4
                                )

                        for filtered_object in filtered_objects:
                            filtered_object["vel"] = filtered_object["vel"].tolist()
                            filtered_object["pos"] = filtered_object["pos"].tolist()

                    self.socketio.emit(
                        "object-points",
                        {
                            "object_points": object_points.tolist(),
                            "errors": errors.tolist(),
                            "objects": [
                                {
                                    k: (v.tolist() if isinstance(v, np.ndarray) else v)
                                    for (k, v) in object.items()
                                }
                                for object in objects
                            ],
                            "filtered_objects": filtered_objects,
                        },
                    )

        return frames

    def get_frames(self, camera=None):
        frames = self._camera_read()
        if camera == None:
            return np.hstack(frames)
        return frames[camera]

    def _find_dot(self, img):
        # img = cv.GaussianBlur(img,(5,5),0)
        grey = cv.cvtColor(img, cv.COLOR_RGB2GRAY)
        grey = cv.threshold(grey, 255 * 0.2, 255, cv.THRESH_BINARY)[1]
        contours, _ = cv.findContours(grey, cv.RETR_TREE, cv.CHAIN_APPROX_SIMPLE)
        img = cv.drawContours(img, contours, -1, (0, 255, 0), 1)

        image_points = []
        for contour in contours:
            moments = cv.moments(contour)
            if moments["m00"] != 0:
                center_x = int(moments["m10"] / moments["m00"])
                center_y = int(moments["m01"] / moments["m00"])
                cv.putText(
                    img,
                    f"({center_x}, {center_y})",
                    (center_x, center_y - 15),
                    cv.FONT_HERSHEY_SIMPLEX,
                    0.3,
                    (100, 255, 100),
                    1,
                )
                cv.circle(img, (center_x, center_y), 1, (100, 255, 100), -1)
                image_points.append([center_x, center_y])

        if len(image_points) == 0:
            image_points = [[None, None]]

        return img, image_points

    def start_capturing_points(self):
        self.is_capturing_points = True

    def stop_capturing_points(self):
        self.is_capturing_points = False

    def start_trangulating_points(self, camera_poses):
        self.is_capturing_points = True
        self.is_triangulating_points = True
        self.camera_poses = camera_poses

    def stop_trangulating_points(self):
        self.is_capturing_points = False
        self.is_triangulating_points = False
        self.camera_poses = None

    def start_locating_objects(self):
        self.is_locating_objects = True

    def stop_locating_objects(self):
        self.is_locating_objects = False
