"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Card, Col, Container, Row } from 'react-bootstrap';
import Form from 'react-bootstrap/Form';
import { Tooltip } from 'react-tooltip'
import { socket } from './lib/socket';
import { defaultCameraPose, defaultWorldMatrix } from './defaultCameraPose';
import DownloadControls from './components/DownloadControls';
import ConnectionManager, { State } from './components/ConnectionManager';
import CameraPoseCalibration from './components/CameraPoseCalibration';
import WorldView from './components/WorldView';
import CameraView from './components/CameraView';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
import { States } from './lib/states';
import useSocketListener from './hooks/useSocketListener';
import Configure from './components/Configure';

export default function App() {
  const [mocapState, setMocapState] = useState(States.ImageProcessing);
  const [isCapturingPoints, setIsCapturingPoints] = useState(false);
  const [parsedCapturedPointsForPose, setParsedCapturedPointsForPose] = useState<Array<Array<Array<number>>>>([]);

  const [isTriangulatingPoints, setIsTriangulatingPoints] = useState(false);
  const [isLocatingObjects, setIsLocatingObjects] = useState(false);

  const objectPoints = useRef<Array<Array<Array<number>>>>([])
  const objectPointTimes = useRef<Array<Array<Array<number>>>>([])
  const filteredObjects = useRef<object[][]>([])
  const objectPointErrors = useRef<Array<Array<number>>>([])
  const imagePoints = useRef<Array<Array<number>>>([])
  const objects = useRef<Array<Array<Object>>>([])
  const [objectPointCount, setObjectPointCount] = useState(0);

  const [cameraPoses, setCameraPoses] = useState<Array<object>>(defaultCameraPose);
  const [toWorldCoordsMatrix, setToWorldCoordsMatrix] = useState<number[][]>(defaultWorldMatrix)

  useSocketListener("state_change", setMocapState);

  const capturePoints = async (startOrStop: string) => {
    socket.emit("capture-points", { startOrStop })
  }

  const stateUpdater = useCallback((newState: State) => {
    setIsCapturingPoints(newState.is_capturing_points);
    setIsTriangulatingPoints(newState.is_triangulating_points);
    setIsLocatingObjects(newState.is_locating_objects);
  }, [])

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

  const startLiveMocap = (startOrStop: string) => {
    socket.emit("triangulate-points", { startOrStop, cameraPoses, toWorldCoordsMatrix })
  }

  return (
    <Container fluid>
      <ConnectionManager updateState={setMocapState} />
      <Row >
        <Col>
          <Card className='shadow-lg'>
            <Tabs
              defaultActiveKey="cameraView"
              id="uncontrolled-tab-example"
              className="mb-3"
            > 
              <Tab eventKey="cameraView" title="🎥 Camera Feed">
                <CameraView
                    mocapState={mocapState}
                    parsedCapturedPointsForPose={parsedCapturedPointsForPose}
                  />
              </Tab>
              <Tab eventKey="worldView" title="🌎 World View">
                <WorldView
                  cameraPoses={cameraPoses} 
                  toWorldCoordsMatrix={toWorldCoordsMatrix}
                  objectPoints={objectPoints}
                  objectPointErrors={objectPointErrors}
                  objectPointCount={objectPointCount}
                  filteredObjects={filteredObjects}
                />
              </Tab>
            </Tabs>
          </Card>
          <div style={{height: "30px"}}></div>
          <Card className='shadow-lg'>
            <Tabs
              defaultActiveKey="configure"
              id="uncontrolled-tab-example"
              className="mb-3"
            > 
              <Tab eventKey="configure" title="⚙️ Configure">
                <Configure 
                  mocapState={mocapState}
                  cameraPoses={cameraPoses}
                  toWorldCoordsMatrix={toWorldCoordsMatrix}
                  setCameraPoses={setCameraPoses}
                  setToWorldCoordsMatrix={setToWorldCoordsMatrix}
                  setParsedCapturedPointsForPose={setParsedCapturedPointsForPose}
                />
              </Tab>
              <Tab eventKey="capture" title="⏺ Capture">
              <Tooltip id="collect-points-for-pose-button-tooltip" />
                  <a  data-tooltip-variant='error' data-tooltip-id='collect-points-for-pose-button-tooltip' data-tooltip-content="Start camera stream first">
                    <Button
                      size='sm'
                      className="mr-2"
                      variant={isCapturingPoints ? "outline-danger" : "outline-primary"}
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
                    onClick={() => {
                      setIsLocatingObjects(!isLocatingObjects);
                      socket.emit("locate-objects", { startOrStop: isLocatingObjects ? "stop" : "start" })
                    }
                    }>
                    {isLocatingObjects ? "Stop" : "Start"} Locating
                  </Button>
                  
                  <div className="mt-2">
                  <DownloadControls type="csv" label="object points" objectPoints={objectPoints} objectPointTimes={objectPointTimes} />
                  <DownloadControls type="csv" label="object errors" objectPoints={objectPointErrors} objectPointTimes={objectPointTimes} />
                  <DownloadControls type="jsonl" label="image points" objectPoints={imagePoints} objectPointTimes={objectPointTimes} />
                  <DownloadControls type="jsonl" label="object track points" objectPoints={filteredObjects} objectPointTimes={objectPointTimes} />
                  </div>
              </Tab>
            </Tabs>
          </Card>
          <div style={{height: "30px"}}></div>
        </Col>
      </Row>
    </Container>
  )
}
