import numpy as np
from scipy import linalg, optimize
import cv2 as cv
from scipy.spatial.transform import Rotation
import copy
import numpy as np
from settings import intrinsic_matrices


def calculate_reprojection_errors(image_points, object_points, camera_poses):
    errors = np.array([])
    for image_points_i, object_point in zip(image_points, object_points):
        error = calculate_reprojection_error(image_points_i, object_point, camera_poses)
        if error is None:
            continue
        errors = np.concatenate([errors, [error]])

    return errors


def calculate_reprojection_error(image_points, object_point, camera_poses):
    image_points = np.array(image_points)
    none_indicies = np.where(np.all(image_points == None, axis=1))[0]
    image_points = np.delete(image_points, none_indicies, axis=0)
    camera_poses = np.delete(camera_poses, none_indicies, axis=0)

    if len(image_points) <= 1:
        return None

    image_points_t = image_points.transpose((0, 1))

    errors = np.array([])
    for i, camera_pose in enumerate(camera_poses):
        if np.all(image_points[i] == None, axis=0):
            continue
        projected_img_points, _ = cv.projectPoints(
            np.expand_dims(object_point, axis=0).astype(np.float32),
            np.array(camera_pose["R"], dtype=np.float64),
            np.array(camera_pose["t"], dtype=np.float64),
            intrinsic_matrices[i],
            np.array([]),
        )
        projected_img_point = projected_img_points[:, 0, :][0]
        errors = np.concatenate(
            [errors, (image_points_t[i] - projected_img_point).flatten() ** 2]
        )

    return errors.mean()


# https://www.cs.jhu.edu/~misha/ReadingSeminar/Papers/Triggs00.pdf
# original bundle adjustment, specifies focal length as an adjustment
# which seems like a mistake since its not used in the residual function
def bundle_adjustment(image_points, camera_poses):

    def params_to_camera_poses(params):
        focal_distances = []
        num_cameras = int((params.size - 1) / 7) + 1
        camera_poses = [{"R": np.eye(3), "t": np.array([0, 0, 0], dtype=np.float32)}]
        focal_distances.append(params[0])
        for i in range(0, num_cameras - 1):
            focal_distances.append(params[i * 7 + 1])
            camera_poses.append(
                {
                    "R": Rotation.as_matrix(
                        Rotation.from_rotvec(params[i * 7 + 2 : i * 7 + 3 + 2])
                    ),
                    "t": params[i * 7 + 3 + 2 : i * 7 + 6 + 2],
                }
            )

        return camera_poses, focal_distances

    def residual_function(params):
        camera_poses, focal_distances = params_to_camera_poses(params)
        object_points = triangulate_points(image_points, camera_poses)
        errors = calculate_reprojection_errors(
            image_points, object_points, camera_poses
        )
        errors = errors.astype(np.float32)
        return errors

    focal_distance = intrinsic_matrices[0][0, 0]
    init_params = np.array([focal_distance])
    for i, camera_pose in enumerate(camera_poses[1:]):
        rot_vec = Rotation.as_rotvec(Rotation.from_matrix(camera_pose["R"])).flatten()
        focal_distance = intrinsic_matrices[i][0,0]
        init_params = np.concatenate([init_params, [focal_distance]])
        init_params = np.concatenate([init_params, rot_vec])
        init_params = np.concatenate([init_params, np.array(camera_pose["t"]).flatten()])

    res = optimize.least_squares(
        residual_function, init_params, verbose=2, loss="linear", ftol=1e-9
    )
    
    return params_to_camera_poses(res.x)[0]

# a much dumber bundle adjustment that just does rotation adjustments
# hope is that this improves accuracy by assuming distances can be pretty well
# calibrated manually
def bundle_adjustment2(image_points, camera_poses):

    def params_to_camera_poses(params):
        for i, _ in enumerate(camera_poses):
            start = i * 3
            end = i * 3 + 3
            camera_poses[i]["R"] = Rotation.as_matrix(
                Rotation.from_rotvec(params[start:end])
            )

        return camera_poses

    def residual_function(params):
        camera_poses = params_to_camera_poses(params)
        object_points = triangulate_points(image_points, camera_poses)
        errors = calculate_reprojection_errors(
            image_points, object_points, camera_poses
        )
        errors = errors.astype(np.float32)
        return errors

    init_params = []
    for i, camera_pose in enumerate(camera_poses):
        rot_vec = Rotation.as_rotvec(Rotation.from_matrix(camera_pose["R"])).flatten()
        init_params = np.concatenate([init_params, rot_vec])
    res = optimize.least_squares(
        residual_function, init_params, verbose=2, loss="linear", ftol=1e-9
    )

    return camera_poses


def triangulate_point(image_points, camera_poses):
    image_points = np.array(image_points)
    none_indicies = np.where(np.all(image_points == None, axis=1))[0]
    image_points = np.delete(image_points, none_indicies, axis=0)
    camera_poses = np.delete(camera_poses, none_indicies, axis=0)

    if len(image_points) <= 1:
        return [None, None, None]

    Ps = camera_poses_to_projection_matrices(camera_poses)

    object_point = DLT(Ps, image_points)

    return object_point


def triangulate_points(image_points, camera_poses):
    object_points = []
    for image_points_i in image_points:
        object_point = triangulate_point(image_points_i, camera_poses)
        object_points.append(object_point)

    return np.array(object_points)

# https://temugeb.github.io/computer_vision/2021/02/06/direct-linear-transorms.html
def DLT(Ps, image_points):
    A = []

    for P, image_point in zip(Ps, image_points):
        A.append(image_point[1] * P[2, :] - P[1, :])
        A.append(P[0, :] - image_point[0] * P[2, :])

    A = np.array(A).reshape((len(Ps) * 2, 4))
    B = A.transpose() @ A
    U, s, Vh = linalg.svd(B, full_matrices=False)
    object_point = Vh[3, 0:3] / Vh[3, 3]

    return object_point

def find_point_correspondance_and_object_points(image_points, camera_poses, frames):
    for image_points_i in image_points:
        try:
            image_points_i.remove([None, None])
        except:
            pass

    # [object_points, possible image_point groups, image_point from camera]
    correspondances = [[[i]] for i in image_points[0]]

    Ps = camera_poses_to_projection_matrices(camera_poses)

    root_image_points = [{"camera": 0, "point": point} for point in image_points[0]]

    for i in range(1, len(frames)):
        epipolar_lines = []
        for root_image_point in root_image_points:
            F = cv.sfm.fundamentalFromProjections(Ps[root_image_point["camera"]], Ps[i])
            line = cv.computeCorrespondEpilines(
                np.array([root_image_point["point"]], dtype=np.float32), 1, F
            )
            epipolar_lines.append(line[0, 0].tolist())
            frames[i] = drawlines(frames[i], line[0])

        not_closest_match_image_points = np.array(image_points[i])
        points = np.array(image_points[i])

        for j, [a, b, c] in enumerate(epipolar_lines):
            distances_to_line = np.array([])
            if len(points) != 0:
                distances_to_line = np.abs(
                    a * points[:, 0] + b * points[:, 1] + c
                ) / np.sqrt(a**2 + b**2)

            possible_matches = points[distances_to_line < 5].copy()

            # Commenting out this code produces more points, but more garbage points too
            # delete closest match from future consideration
            # if len(points) != 0:
            #     points = np.delete(points, np.argmin(distances_to_line), axis=0)

            # sort possible matches from smallest to largest
            distances_to_line = distances_to_line[distances_to_line < 5]
            possible_matches_sorter = distances_to_line.argsort()
            possible_matches = possible_matches[possible_matches_sorter]

            if len(possible_matches) == 0:
                for possible_group in correspondances[j]:
                    possible_group.append([None, None])
            else:
                not_closest_match_image_points = [
                    row
                    for row in not_closest_match_image_points.tolist()
                    if row != possible_matches.tolist()[0]
                ]
                not_closest_match_image_points = np.array(
                    not_closest_match_image_points
                )

                new_correspondances_j = []
                for possible_match in possible_matches:
                    temp = copy.deepcopy(correspondances[j])
                    for possible_group in temp:
                        possible_group.append(possible_match.tolist())
                    new_correspondances_j += temp
                correspondances[j] = new_correspondances_j

        for not_closest_match_image_point in not_closest_match_image_points:
            root_image_points.append(
                {"camera": i, "point": not_closest_match_image_point}
            )
            temp = [[[None, None]] * i]
            temp[0].append(not_closest_match_image_point.tolist())
            correspondances.append(temp)

    object_points = []
    errors = []
    for image_points in correspondances:
        object_points_i = triangulate_points(image_points, camera_poses)

        if np.all(object_points_i == None):
            continue

        errors_i = calculate_reprojection_errors(
            image_points, object_points_i, camera_poses
        )

        object_points.append(object_points_i[np.argmin(errors_i)])
        errors.append(np.min(errors_i))

    return np.array(errors), np.array(object_points), frames


def locate_objects(object_points, errors):
    dist = 0.131
    dist1 = 0.089
    dist2 = 0.133

    distance_matrix = np.zeros((object_points.shape[0], object_points.shape[0]))
    already_matched_points = []
    objects = []

    for i in range(0, object_points.shape[0]):
        for j in range(0, object_points.shape[0]):
            distance_matrix[i, j] = np.sqrt(
                np.sum((object_points[i] - object_points[j]) ** 2)
            )
    print("----")
    print(distance_matrix)
    print("----")
    for i in range(0, object_points.shape[0]):
        if i in already_matched_points:
            continue
        matches = np.abs(distance_matrix[i] - dist) < 0.025
        if np.any(matches):
            best_match_i = np.argmax(matches)

            already_matched_points.append(i)
            already_matched_points.append(best_match_i)

            location = (object_points[i]+object_points[best_match_i])/2
            error = np.mean([errors[i], errors[best_match_i]])

            heading_vec = object_points[best_match_i] - object_points[i]
            heading_vec /= linalg.norm(heading_vec)
            heading = np.arctan2(heading_vec[1], heading_vec[0])

            heading = heading - np.pi if heading > np.pi/2 else heading
            heading = heading + np.pi if heading < -np.pi/2 else heading

            objects.append({
                "pos": location,
                "heading": -heading,
                "error": error,
                "droneIndex": 0
            })
        # distance_deltas = np.abs(distance_matrix[i] - dist1)
        # print(distance_deltas < 0.025)
        # num_matches = distance_deltas < 0.025
        
        # matches_index = np.where(distance_deltas < 0.025)[0]
        # print("----")
        # if np.sum(num_matches) >= 2:
        #     for possible_pair in cartesian_product(matches_index, matches_index):
        #         pair_distance = np.sqrt(
        #             np.sum(
        #                 (
        #                     object_points[possible_pair[0]]
        #                     - object_points[possible_pair[1]]
        #                 )
        #                 ** 2
        #             )
        #         )
        #         print(pair_distance)

        #         # if the pair isnt the correct distance apart
        #         if np.abs(pair_distance - dist2) > 0.025:
        #             continue

        #         best_match_1_i = possible_pair[0]
        #         best_match_2_i = possible_pair[1]

        #         already_matched_points.append(i)
        #         already_matched_points.append(best_match_1_i)
        #         already_matched_points.append(best_match_2_i)

        #         location = (
        #             object_points[best_match_1_i] + object_points[best_match_2_i]
        #         ) / 2
        #         error = np.mean(
        #             [errors[i], errors[best_match_1_i], errors[best_match_2_i]]
        #         )

        #         heading_vec = (
        #             object_points[best_match_1_i] - object_points[best_match_2_i]
        #         )
        #         heading_vec /= linalg.norm(heading_vec)
        #         heading = np.arctan2(heading_vec[1], heading_vec[0])

        #         heading = heading - np.pi if heading > np.pi / 2 else heading
        #         heading = heading + np.pi if heading < -np.pi / 2 else heading

        #         # determine drone index based on which side third light is on
        #         drone_index = 0 if (object_points[i] - location)[1] > 0 else 1

        #         objects.append(
        #             {
        #                 "pos": location,
        #                 "heading": -heading,
        #                 "error": error,
        #                 "droneIndex": drone_index,
        #             }
        #         )

        #         break

    return objects


def drawlines(img1, lines):
    r, c, _ = img1.shape
    for r in lines:
        color = tuple(np.random.randint(0, 255, 3).tolist())
        x0, y0 = map(int, [0, -r[2] / r[1]])
        x1, y1 = map(int, [c, -(r[2] + r[0] * c) / r[1]])
        img1 = cv.line(img1, (x0, y0), (x1, y1), color, 1)
    return img1

# TODO - Camera poses probably deserve their own type that can be marshalled at the api boundary
def camera_poses_to_serializable(camera_poses):
    for i in range(0, len(camera_poses)):
        camera_poses[i] = {k: v.tolist() for (k, v) in camera_poses[i].items()}

    return camera_poses

def camera_pose_to_internal(serialized_camera_poses):
    for i in range(0, len(serialized_camera_poses)):
        serialized_camera_poses[i] = {k: np.array(v) for (k, v) in serialized_camera_poses[i].items()}

    return serialized_camera_poses


# Opportunity for performance improvements here. This doesn't change
# for a given capture but is recalculated fairly deep down the run loop
def camera_poses_to_projection_matrices(camera_poses):
    Ps = []
    for i, camera_pose in enumerate(camera_poses):
        RT = np.c_[camera_pose["R"], camera_pose["t"]]
        P = intrinsic_matrices[i] @ RT
        Ps.append(P)
    return Ps

def cartesian_product(x, y):
    return np.array([[x0, y0] for x0 in x for y0 in y])

def make_square(img):
    x, y, _ = img.shape
    size = max(x, y)
    new_img = np.zeros((size, size, 3), dtype=np.uint8)
    ax, ay = (size - img.shape[1]) // 2, (size - img.shape[0]) // 2
    new_img[ay : img.shape[0] + ay, ax : ax + img.shape[1]] = img

    # Pad the new_img array with edge pixel values
    # Apply feathering effect
    feather_pixels = 8
    for i in range(feather_pixels):
        alpha = (i + 1) / feather_pixels
        new_img[ay - i - 1, :] = img[0, :] * (1 - alpha)  # Top edge
        new_img[ay + img.shape[0] + i, :] = img[-1, :] * (1 - alpha)  # Bottom edge

    return new_img
