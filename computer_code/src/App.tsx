"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { Badge, Button, Card, Col, Container, Row } from 'react-bootstrap';
import Form from 'react-bootstrap/Form';
import { Tooltip } from 'react-tooltip'
import CameraWireframe from './components/CameraWireframe';
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import Points from './components/Points';
import { socket } from './shared/styles/scripts/socket';
import Objects from './components/Objects';
import { defaultCameraPose, defaultWorldMatrix } from './defaultCameraPose';
import PosePoints from './components/PosePoints';
import DownloadControls from './components/DownloadControls';
import ConnectionManager, { State } from './components/ConnectionManager';
import CameraSettings from './components/CameraSettings';
import CameraPoseCalibration from './components/CameraPoseCalibration';

const ALL_CAMS = "all"

export default function App() {
  const [cameraStreamRunning, setCameraStreamRunning] = useState(false);

  const [isCapturingPoints, setIsCapturingPoints] = useState(false);
  const [parsedCapturedPointsForPose, setParsedCapturedPointsForPose] = useState<Array<Array<Array<number>>>>([]);
  const [numCams, setNumCams] = useState(0);
  const [activeCam, setActiveCam] = useState(ALL_CAMS);

  const [isTriangulatingPoints, setIsTriangulatingPoints] = useState(false);
  const [isLocatingObjects, setIsLocatingObjects] = useState(false);

  const objectPoints = useRef<Array<Array<Array<number>>>>([])
  const objectPointTimes = useRef<Array<Array<Array<number>>>>([])
  const filteredObjects = useRef<object[][]>([])
  const objectPointErrors = useRef<Array<Array<number>>>([])
  const imagePoints = useRef<Array<Array<number>>>([])
  const objects = useRef<Array<Array<Object>>>([])
  const [objectPointCount, setObjectPointCount] = useState(0);

  const [fps, setFps] = useState(0);

  const [cameraPoses, setCameraPoses] = useState<Array<object>>(defaultCameraPose);
  const [toWorldCoordsMatrix, setToWorldCoordsMatrix] = useState<number[][]>(defaultWorldMatrix)

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
      socket.off("error")
      socket.off("success")
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
      objectPointTimes.current.push(data["time_ms"])
      if (data["filtered_objects"].length != 0) {
        filteredObjects.current.push(data["filtered_objects"])
      }
      objectPointErrors.current.push(data["errors"])
      imagePoints.current.push(data["image_points"])
      objects.current.push(data["objects"])
      setObjectPointCount(objectPointCount + 1)
    })

    return () => {
      socket.off("object-points")
    }
  }, [objectPointCount])

  useEffect(() => {
    socket.on("camera-pose", data => {
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

  return (
    <Container fluid>
      <ConnectionManager updateState={stateUpdater} />
      <Row >
        <Col>
          <Card className='shadow-lg'>
            <Card.Header><h2>Weccap</h2></Card.Header>
            <Card.Body>
              <Row>
                <Col xs={10}>
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
                  <CameraSettings />
                  <CameraPoseCalibration cameraPoses={cameraPoses} setParsedCapturedPointsForPose={setParsedCapturedPointsForPose} />
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
              <Row>
                <Col xs={10}>
                  <Tooltip id="collect-points-for-pose-button-tooltip" />
                  <a data-tooltip-hidden={cameraStreamRunning} data-tooltip-variant='error' data-tooltip-id='collect-points-for-pose-button-tooltip' data-tooltip-content="Start camera stream first">
                    <Button
                      size='sm'
                      className="mr-2"
                      variant={isCapturingPoints ? "outline-danger" : "outline-primary"}
                      disabled={!cameraStreamRunning}
                      onClick={() => {
                        setIsCapturingPoints(!isCapturingPoints);
                        capturePoints(isCapturingPoints ? "stop" : "start");
                      }
                      }>
                      {isCapturingPoints ? "Stop" : "Start"} Tracking
                    </Button>
                  </a>
                  <Tooltip id="start-tri-tooltip" />
                  <a data-tooltip-hidden={isCapturingPoints} data-tooltip-variant='error' data-tooltip-id='start-tri-tooltip' data-tooltip-content="Start tracking first">
                  <Button
                    size='sm'
                    className="mr-2"
                    variant={isTriangulatingPoints ? "outline-danger" : "outline-primary"}
                    disabled={!isCapturingPoints}
                    onClick={() => {
                      if (!isTriangulatingPoints) {
                        objectPoints.current = []
                        objectPointTimes.current = [];
                        imagePoints.current = []
                        objectPointErrors.current = []
                        objects.current = []
                        filteredObjects.current = []
                      }
                      setIsTriangulatingPoints(!isTriangulatingPoints);
                      startLiveMocap(isTriangulatingPoints ? "stop" : "start");
                    }
                    }>
                    {isTriangulatingPoints ? "Stop" : "Start"} Triangulating
                  </Button>
                  </a>
                  <Button
                    size='sm'
                    className="mr-2"
                    variant={isLocatingObjects ? "outline-danger" : "outline-primary"}
                    disabled={!cameraStreamRunning}
                    onClick={() => {
                      setIsLocatingObjects(!isLocatingObjects);
                      socket.emit("locate-objects", { startOrStop: isLocatingObjects ? "stop" : "start" })
                    }
                    }>
                    {isLocatingObjects ? "Stop" : "Start"} Locating
                  </Button>
                  <Button
                    size='sm'
                    className="mr-2"
                    variant="outline-primary"
                    disabled={!isTriangulatingPoints && objectPoints.current.length == 0}
                    onClick={() => {
                      socket.emit("determine-scale", { objectPoints: objectPoints.current, cameraPoses: cameraPoses })
                    }
                    }>
                    Set scale
                  </Button>
                  <Button
                    size='sm'
                    className="mr-2"
                    variant="outline-primary"
                    disabled={!isTriangulatingPoints && objectPoints.current.length == 0}
                    onClick={() => {
                      socket.emit("set-origin", { objectPoint: objectPoints.current[0][0], toWorldCoordsMatrix })
                    }
                    }>
                    Set origin
                  </Button>
                  <Button
                    size='sm'
                    variant="outline-primary"
                    disabled={!isTriangulatingPoints && objectPoints.current.length == 0}
                    onClick={() => {
                      socket.emit("acquire-floor", { objectPoints: objectPoints.current })
                    }
                    }>
                    Acquire Floor
                  </Button>
                  <DownloadControls type="csv" label="object points" objectPoints={objectPoints} objectPointTimes={objectPointTimes} />
                  <DownloadControls type="csv" label="object errors" objectPoints={objectPointErrors} objectPointTimes={objectPointTimes} />
                  <DownloadControls type="jsonl" label="image points" objectPoints={imagePoints} objectPointTimes={objectPointTimes} />
                  <DownloadControls type="jsonl" label="object track points" objectPoints={filteredObjects} objectPointTimes={objectPointTimes} />
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
              <Col style={{ height: "1000px" }}>
                <Canvas orthographic camera={{ zoom: 1000, position: [0, 0, 10] }}>
                  <ambientLight />
                  {cameraPoses.map(({ R, t }, i) => (
                    <CameraWireframe R={R} t={t} toWorldCoordsMatrix={toWorldCoordsMatrix} key={i} />
                  ))}
                  <Points objectPointsRef={objectPoints} objectPointErrorsRef={objectPointErrors} count={objectPointCount} />
                  <Objects filteredObjectsRef={filteredObjects} count={objectPointCount} />
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
      <Row className='pt-3'>
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
    </Container>
  )
}
