"use client";

import { FormEventHandler, useState, useRef, useEffect, useCallback } from 'react';
import { Badge, Button, Card, Col, Container, Row } from 'react-bootstrap';
import Form from 'react-bootstrap/Form';
import { Tooltip } from 'react-tooltip'
import CameraWireframe from './components/CameraWireframe';
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import Points from './components/Points';
import { socket } from './shared/styles/scripts/socket';
import Objects from './components/Objects';
import TrajectoryPlanningSetpoints from './components/TrajectoryPlanningSetpoints';
import { defaultCameraPose, defaultWorldMatrix } from './defaultCameraPose';
import PosePoints from './components/PosePoints';
import RecordingControls from './components/RecordingControls';
import ConnectionManager, { State } from './components/ConnectionManager';

const NUM_DRONES = 2
const ALL_CAMS = "all"

export default function App() {
  const [cameraStreamRunning, setCameraStreamRunning] = useState(false);

  const [exposure, setExposure] = useState(100);
  const [gain, setGain] = useState(0);

  const [isCapturingPoints, setIsCapturingPoints] = useState(false);
  const [captureNextPointForPose, setCaptureNextPointForPose] = useState(false)
  const [capturedPointsForPose, setCapturedPointsForPose] = useState("");
  const [parsedCapturedPointsForPose, setParsedCapturedPointsForPost] = useState<Array<Array<Array<number>>>>([]);
  const [numCams, setNumCams] = useState(0);
  const [activeCam, setActiveCam] = useState(ALL_CAMS);

  const [isTriangulatingPoints, setIsTriangulatingPoints] = useState(false);
  const [isLocatingObjects, setIsLocatingObjects] = useState(false);

  const objectPoints = useRef<Array<Array<Array<number>>>>([])
  const filteredObjects = useRef<object[][]>([])
  const objectPointErrors = useRef<Array<Array<number>>>([])
  const objects = useRef<Array<Array<Object>>>([])
  const [objectPointCount, setObjectPointCount] = useState(0);

  const [fps, setFps] = useState(0);

  const [cameraPoses, setCameraPoses] = useState<Array<object>>(defaultCameraPose);
  const [toWorldCoordsMatrix, setToWorldCoordsMatrix] = useState<number[][]>(defaultWorldMatrix)

  const [droneSetpointWithMotion, setDroneSetpointWithMotion] = useState([0, 0, 0])
  const [trajectoryPlanningSetpoints, setTrajectoryPlanningSetpoints] = useState<number[][][]>([])

  const updateCameraSettings: FormEventHandler = (e) => {
    e.preventDefault()
    socket.emit("update-camera-settings", {
      exposure,
      gain,
    })
  }

  const capturePoints = async (startOrStop: string) => {
    socket.emit("capture-points", { startOrStop })
  }

  const stateUpdater = useCallback((newState: State) => {
    setIsCapturingPoints(newState.is_capturing_points);
    setIsTriangulatingPoints(newState.is_triangulating_points);
    setIsLocatingObjects(newState.is_locating_objects);
    setCameraStreamRunning(false);
    setTimeout(async () => {
      setCameraStreamRunning(true);
    }, 1000)
  }, [])


  useEffect(() => {
    const handler = (data: any) => {
      if (captureNextPointForPose) {
        const newVal = `${capturedPointsForPose}${JSON.stringify(data)},`;
        setCapturedPointsForPose(newVal);
        setParsedCapturedPointsForPost(JSON.parse(`[${newVal.slice(0, -1)}]`))
        console.log(capturedPointsForPose);
        setCaptureNextPointForPose(false);
      }
    }
    socket.on("image-points", handler)

    return () => {
      socket.off("image-points", handler)
    }
  }, [capturedPointsForPose, captureNextPointForPose])

  useEffect(() => {
    socket.on("num-cams", (data) => {
      setNumCams(data)
    })

    return () => {
      socket.off("num-cams")
    }
  }, [numCams])

  useEffect(() => {
    socket.on("error", (msg) => {
      console.log(msg)
    });
    socket.on("success", (msg) => {
      console.log(msg)
    });


    return () => {
      socket.off("num-cams")
    }
  }, [numCams])

  useEffect(() => {
    socket.on("to-world-coords-matrix", (data) => {
      setToWorldCoordsMatrix(data["to_world_coords_matrix"])
      setObjectPointCount(objectPointCount + 1)
    })

    return () => {
      socket.off("to-world-coords-matrix")
    }
  }, [objectPointCount])

  useEffect(() => {
    socket.on("object-points", (data) => {
      objectPoints.current.push(data["object_points"])
      if (data["filtered_objects"].length != 0) {
        filteredObjects.current.push(data["filtered_objects"])
      }
      objectPointErrors.current.push(data["errors"])
      objects.current.push(data["objects"])
      setObjectPointCount(objectPointCount + 1)
    })

    return () => {
      socket.off("object-points")
    }
  }, [objectPointCount])

  useEffect(() => {
    socket.on("camera-pose", data => {
      console.log(data)
      setCameraPoses(data["camera_poses"])
    })

    return () => {
      socket.off("camera-pose")
    }
  }, [])

  useEffect(() => {
    socket.on("fps", data => {
      setFps(data["fps"])
    })

    return () => {
      socket.off("fps")
    }
  }, [])

  const calculateCameraPose = async (cameraPoints: Array<Array<Array<number>>>) => {
    socket.emit("calculate-camera-pose", { cameraPoints })
  }

  const isValidJson = (str: string) => {
    try {
      const o = JSON.parse(str);
      if (o && typeof o === "object") {
        return true;
      }
    } catch (e) { }
    return false;
  }

  const startLiveMocap = (startOrStop: string) => {
    socket.emit("triangulate-points", { startOrStop, cameraPoses, toWorldCoordsMatrix })
  }

  const getCameraButtons = (numCams: number) => {
    let content = [];
    content.push(<Button
      size='sm'
      className='me-3'
      variant={"outline-primary"}
      active={activeCam === ALL_CAMS}
      onClick={() => {
        setActiveCam(ALL_CAMS);
      }}
    >
      All
    </Button>
    )
    for (let i = 0; i < numCams; i++) {
      content.push(<Button
        size='sm'
        className='me-3'
        variant={"outline-primary"}
        active={activeCam === i}
        onClick={() => {
          setActiveCam(i);
        }}
      >
        Camera {i}
      </Button>);
    }
    return content;
  }

  const countOfPointsForCameraPoseCalibration = isValidJson(`[${capturedPointsForPose.slice(0, -1)}]`) ? JSON.parse(`[${capturedPointsForPose.slice(0, -1)}]`).length : 0;

  return (
    <Container fluid>
      <ConnectionManager updateState={stateUpdater} />
      <Row >
        <Col>
          <Card className='shadow-lg'>
            <Card.Header><h2>Weccap</h2></Card.Header>
            <Card.Body>
              <Row>
                <Col>
                  <Button
                    size='sm'
                    className='me-3'
                    variant={cameraStreamRunning ? "outline-danger" : "outline-success"}
                    onClick={() => {
                      setCameraStreamRunning(!cameraStreamRunning);
                    }}
                  >
                    {cameraStreamRunning ? "Stop" : "Start camera stream"}
                  </Button>
                  {getCameraButtons(numCams)}
                </Col>
                <Col style={{ textAlign: "right" }}>
                  {cameraStreamRunning && <Badge style={{ minWidth: 80 }} bg={fps < 25 ? "danger" : fps < 60 ? "warning" : "success"}>FPS: {fps}</Badge>}
                </Col>
              </Row>
              <Row className='mt-2 mb-1' style={{ height: "320px" }}>
                <Col style={{ "position": "relative", paddingLeft: 10 }}>
                  <img src={cameraStreamRunning ? `http://localhost:3001/api/camera-stream${activeCam === ALL_CAMS ? "" : `?camera=${activeCam}`}` : ""} />
                  <PosePoints numCams={numCams} points={parsedCapturedPointsForPose} />
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      <Row className='pt-3'>
        <Col xs={4}>
          <Card className='shadow-lg h-100'>
            <Card.Header>Camera settings</Card.Header>
            <Card.Body>
              <Row className='pt-3'>
                <Col xs="4">
                  <Form onChange={updateCameraSettings} className='ps-3'>
                    <Form.Group className="mb-1">
                      <Form.Label>Exposure: {exposure}</Form.Label>
                      <Form.Range value={exposure} onChange={(event) => setExposure(parseFloat(event.target.value))} />
                    </Form.Group>
                    <Form.Group className="mb-1">
                      <Form.Label>Gain: {gain}</Form.Label>
                      <Form.Range value={gain} onChange={(event) => setGain(parseFloat(event.target.value))} />
                    </Form.Group>
                  </Form>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={4}>
          <Card className='shadow-lg h-100'>
            <Card.Header>Calibration</Card.Header>
            <Card.Body>
              <Row>
                <Col xs="auto">
                  <h5>Start tracking points</h5>
                </Col>
                <Col>
                  <Tooltip id="collect-points-for-pose-button-tooltip" />
                  <a data-tooltip-hidden={cameraStreamRunning} data-tooltip-variant='error' data-tooltip-id='collect-points-for-pose-button-tooltip' data-tooltip-content="Start camera stream first">
                    <Button
                      size='sm'
                      variant={isCapturingPoints ? "outline-danger" : "outline-primary"}
                      disabled={!cameraStreamRunning}
                      onClick={() => {
                        setIsCapturingPoints(!isCapturingPoints);
                        capturePoints(isCapturingPoints ? "stop" : "start");
                      }
                      }>
                      {isCapturingPoints ? "Stop" : "Start"}
                    </Button>

                  </a>
                </Col>
              </Row>
              <Row>
                <Col xs="auto">
                  <h5>Camera pose calibration</h5>
                </Col>
              </Row>
              <Row>
                <Col>
                  {countOfPointsForCameraPoseCalibration} points collected for camera pose calibration
                  <Button
                    size='sm'
                    variant="outline-primary"
                    disabled={!isCapturingPoints}
                    onClick={() => {
                      setCaptureNextPointForPose(true);
                    }
                    }>
                    Capture point
                  </Button>
                  <Button
                    size='sm'
                    className="m-3"
                    variant="outline-primary"
                    disabled={countOfPointsForCameraPoseCalibration === 0}
                    onClick={() => {
                      calculateCameraPose(JSON.parse(`[${capturedPointsForPose.slice(0, -1)}]`))
                    }}>
                    Calculate camera pose
                  </Button>
                  <Button
                    size='sm'
                    variant="outline-danger"
                    disabled={countOfPointsForCameraPoseCalibration === 0}
                    onClick={() => {
                      setCapturedPointsForPose("")
                      setParsedCapturedPointsForPost([]);
                    }}>
                    Clear points
                  </Button>
                </Col>
              </Row>
              <Row>
                <Col xs="auto">
                  <h5>Live Triangulation</h5>
                </Col>
                <Col>
                  <Button
                    size='sm'
                    variant={isTriangulatingPoints ? "outline-danger" : "outline-primary"}
                    disabled={!cameraStreamRunning}
                    onClick={() => {
                      if (!isTriangulatingPoints) {
                        objectPoints.current = []
                        objectPointErrors.current = []
                        objects.current = []
                        filteredObjects.current = []
                      }
                      setIsTriangulatingPoints(!isTriangulatingPoints);
                      startLiveMocap(isTriangulatingPoints ? "stop" : "start");
                    }
                    }>
                    {isTriangulatingPoints ? "Stop" : "Start"}
                  </Button>
                </Col>
              </Row>
              <Row>
                <Col xs="auto">
                  <h5>Locate Objects</h5>
                </Col>
                <Col>
                  <Button
                    size='sm'
                    variant={isLocatingObjects ? "outline-danger" : "outline-primary"}
                    disabled={!cameraStreamRunning}
                    onClick={() => {
                      setIsLocatingObjects(!isLocatingObjects);
                      socket.emit("locate-objects", { startOrStop: isLocatingObjects ? "stop" : "start" })
                    }
                    }>
                    {isLocatingObjects ? "Stop" : "Start"}
                  </Button>
                </Col>
              </Row>
              <Row>
                <Col xs="auto">
                  <h5>Set Scale Using Points</h5>
                </Col>
                <Col>
                  <Button
                    size='sm'
                    variant="outline-primary"
                    disabled={!isTriangulatingPoints && objectPoints.current.length == 0}
                    onClick={() => {
                      socket.emit("determine-scale", { objectPoints: objectPoints.current, cameraPoses: cameraPoses })
                    }
                    }>
                    Run
                  </Button>
                </Col>
              </Row>
              <Row>
                <Col xs="auto">
                  <h5>Acquire Floor</h5>
                </Col>
                <Col>
                  <Button
                    size='sm'
                    variant="outline-primary"
                    disabled={!isTriangulatingPoints && objectPoints.current.length == 0}
                    onClick={() => {
                      socket.emit("acquire-floor", { objectPoints: objectPoints.current })
                    }
                    }>
                    Run
                  </Button>
                </Col>
              </Row>
              <Row>
                <Col xs="auto">
                  <h5>Set Origin</h5>
                </Col>
                <Col>
                  <Button
                    size='sm'
                    variant="outline-primary"
                    disabled={!isTriangulatingPoints && objectPoints.current.length == 0}
                    onClick={() => {
                      socket.emit("set-origin", { objectPoint: objectPoints.current[0][0], toWorldCoordsMatrix })
                    }
                    }>
                    Run
                  </Button>
                </Col>
              </Row>
              <Row>
                <Col xs="auto">
                  <h5>Download points</h5>
                </Col>
                <Col>
                  <RecordingControls objectPoints={objectPoints} />
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={4}>
          <Card className='shadow-lg h-100'>
            <Card.Header>Configuration</Card.Header>
            <Card.Body>
              <Row className='pt-3'>
                <Col xs={4} className='pt-2'>
                  Camera Poses:
                </Col>
                <Col>
                  <Form.Control
                    value={JSON.stringify(cameraPoses)}
                    onChange={(event) => setCameraPoses(JSON.parse(event.target.value))}
                  />
                </Col>
              </Row>
              <Row>
                <Col xs={4} className='pt-2'>
                  To World Matrix:
                </Col>
                <Col>
                  <Form.Control
                    value={JSON.stringify(toWorldCoordsMatrix)}
                    onChange={(event) => setToWorldCoordsMatrix(JSON.parse(event.target.value))}
                  />
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      <Row className='pt-3'>
        <Col>
          <Card className='shadow-sm p-3'>
            <Row>
              <Col xs="auto">
                {/* <h4>Scene Viewer {objectPointErrors.current.length !== 0 ? mean(objectPointErrors.current.flat()) : ""}</h4> */}
              </Col>
            </Row>
            <Row>
              <Col style={{ height: "1000px" }}>
                <Canvas orthographic camera={{ zoom: 1000, position: [0, 0, 10] }}>
                  <ambientLight />
                  {cameraPoses.map(({ R, t }, i) => (
                    <CameraWireframe R={R} t={t} toWorldCoordsMatrix={toWorldCoordsMatrix} key={i} />
                  ))}
                  <Points objectPointsRef={objectPoints} objectPointErrorsRef={objectPointErrors} count={objectPointCount} />
                  <Objects filteredObjectsRef={filteredObjects} count={objectPointCount} />
                  <TrajectoryPlanningSetpoints trajectoryPlanningSetpoints={trajectoryPlanningSetpoints} NUM_DRONES={NUM_DRONES} />
                  <OrbitControls />
                  <axesHelper args={[0.2]} />
                  <gridHelper args={[4, 4 * 10]} />
                  <directionalLight />
                </Canvas>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </Container>
  )
}
