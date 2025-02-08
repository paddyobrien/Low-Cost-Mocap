from helpers import camera_pose_to_serializable, calculate_reprojection_errors, bundle_adjustment, triangulate_points

import cv2 as cv
import numpy as np
import json

points = [[[199,118],[174,213],[191,158],[143,97]],[[167,46],[48,239],[221,247],[283,73]],[[133,47],[76,272],[263,225],[None,None]],[[271,142],[175,168],[125,147],[145,221]],[[167,139],[164,273],[209,183],[133,143]],[[243,173],[184,210],[142,157],[95,263]],[[169,154],[240,239],[220,124],[40,62]],[[235,73],[105,172],[151,199],[288,120]],[[255,108],[99,188],[114,219],[297,271]],[[251,99],[113,178],[128,200],[277,205]],[[272,187],[218,178],[132,120],[6,249]],[[183,60],[96,214],[207,209],[251,63]],[[146,113],[187,263],[240,160],[122,52]],[[141,69],[100,274],[248,215],[213,57]],[[146,262],[None,None],[227,87],[None,None]]]

num_cameras = 4
intrinsic_matrix = np.array([[320.0,   0, 160],
                            [    0, 320, 160],
                            [    0,   0,   1]])
image_points = np.array(points)

image_points_t = image_points.transpose((1, 0, 2))

camera_poses = [{
    "R": np.eye(3),
    "t": np.array([[0],[0],[0]], dtype=np.float32)
}]
for camera_i in range(0, num_cameras-1):
    camera1_image_points = image_points_t[camera_i]
    camera2_image_points = image_points_t[camera_i+1]
    not_none_indicies = np.where(np.all(camera1_image_points != None, axis=1) & np.all(camera2_image_points != None, axis=1))[0]
    camera1_image_points = np.take(camera1_image_points, not_none_indicies, axis=0).astype(np.float32)
    camera2_image_points = np.take(camera2_image_points, not_none_indicies, axis=0).astype(np.float32)

    F, _ = cv.findFundamentalMat(camera1_image_points, camera2_image_points, cv.FM_LMEDS, 3, 0.99999)
    if F is None:
        print("Could not compute fundamental matrix")
        exit()
    E = cv.sfm.essentialFromFundamental(F, intrinsic_matrix, intrinsic_matrix)
    possible_Rs, possible_ts = cv.sfm.motionFromEssential(E)

    R = None
    t = None
    max_points_infront_of_camera = 0
    for i in range(0, 4):
        object_points = triangulate_points(
            np.hstack([
                np.expand_dims(camera1_image_points, axis=1), 
                np.expand_dims(camera2_image_points, axis=1)
            ]), 
            np.concatenate([
                [camera_poses[-1]], 
                [{
                    "R": possible_Rs[i], 
                    "t": possible_ts[i]}
                ]
            ])
        )
        object_points_camera_coordinate_frame = np.array([
            possible_Rs[i].T @ object_point for object_point in object_points
        ])

        points_infront_of_camera = np.sum(object_points[:,2] > 0) + np.sum(object_points_camera_coordinate_frame[:,2] > 0)

        if points_infront_of_camera > max_points_infront_of_camera:
            max_points_infront_of_camera = points_infront_of_camera
            R = possible_Rs[i]
            t = possible_ts[i]

    R = R @ camera_poses[-1]["R"]
    t = camera_poses[-1]["t"] + (camera_poses[-1]["R"] @ t)

    camera_poses.append({
        "R": R,
        "t": t
    })

camera_poses = bundle_adjustment(image_points, camera_poses)

object_points = triangulate_points(image_points, camera_poses)
error = np.mean(calculate_reprojection_errors(image_points, object_points, camera_poses))
print(camera_pose_to_serializable(camera_poses))
print(f"Error {error}")