from scipy.spatial.transform import Rotation
import numpy as np
import json


# convert the camera pose rotation matrix into to a euler rotation
# which is vaguely human readable and therefore useful for sanity checking values
pose = [{"R": [[0.7071067811865476, -0.5656854249492382, 0.42426406871192845], [-5.551115123125783e-17, 0.5999999999999999, 0.8000000000000002], [-0.7071067811865476, -0.5656854249492381, 0.42426406871192845]], "t": [-0.15, -0.3, -0.15]}, {"R": [[0.7071067811865476, 0.5656854249492382, -0.42426406871192845], [5.551115123125783e-17, 0.5999999999999999, 0.8000000000000002], [0.7071067811865476, -0.5656854249492381, 0.42426406871192845]], "t": [0.15, -0.3, -0.15]}, {"R": [[-0.7071067811865476, 0.5656854249492382, -0.42426406871192845], [0.0, 0.6, 0.8000000000000002], [0.7071067811865476, 0.5656854249492381, -0.42426406871192845]], "t": [0.15, -0.3, 0.15]}, {"R": [[-0.7071067811865476, -0.565685424949238, 0.42426406871192834], [5.551115123125783e-17, 0.6, 0.8000000000000002], [-0.7071067811865475, 0.5656854249492381, -0.4242640687119285]], "t": [-0.15, -0.3, 0.15]}]
human = []

def humanize(mat):
    r = Rotation.from_matrix(mat)
    return r.as_euler("xyz", degrees=True)

class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)

for i, p in enumerate(pose):
    human.append({
        "R": humanize(p["R"]),
        "t": p["t"]
    })

print(json.dumps(human, indent=2, cls=NumpyEncoder))