"use client";

import { useState, useRef, useEffect } from 'react';
import { Button, Card, Col, Container, Row } from 'react-bootstrap';
import { Tooltip } from 'react-tooltip'
import { socket } from './lib/socket';
import { defaultCameraPose, defaultWorldMatrix } from './defaultCameraPose';
import DownloadControls from './components/DownloadControls';
import ConnectionManager from './components/ConnectionManager';
import WorldView from './components/WorldView';
import CameraView from './components/CameraView';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
import { States } from './lib/states';
import useSocketListener from './hooks/useSocketListener';
import Configure from './components/Configure';
import Capture from './components/Capture';
import Logo from './components/Logo';

export default function App() {
  const [mocapState, setMocapState] = useState(States.ImageProcessing);
  const [parsedCapturedPointsForPose, setParsedCapturedPointsForPose] = useState<Array<Array<Array<number>>>>([]);


  const objectPoints = useRef<Array<Array<Array<number>>>>([])
  const filteredObjects = useRef<object[][]>([])
  const objectPointErrors = useRef<Array<Array<number>>>([])
  const [lastObjectPointTimestamp, setLastObjectPointTimestamp] = useState(0);

  const [cameraPoses, setCameraPoses] = useState<Array<object>>(defaultCameraPose);
  const [toWorldCoordsMatrix, setToWorldCoordsMatrix] = useState<number[][]>(defaultWorldMatrix)

  useEffect(() => {
      const recordTime = (data) => {
        setLastObjectPointTimestamp(data["time_ms"])
      }
      socket.on("object-points", recordTime)
      return () => {
          socket.off("object-points", recordTime)
      }
  }, [])

  useSocketListener("state_change", setMocapState);

  useEffect(() => {
    socket.on("to-world-coords-matrix", (data) => {
      setToWorldCoordsMatrix(data["to_world_coords_matrix"])
    })

    return () => {
      socket.off("to-world-coords-matrix")
    }
  }, [])

  useEffect(() => {
    socket.on("camera-pose", data => {
      setCameraPoses(data["camera_poses"])
    })

    return () => {
      socket.off("camera-pose")
    }
  }, [])

  return (
    <Container fluid>
      <Logo />
      <ConnectionManager updateState={setMocapState} />
      <Row style={{marginTop: 55}}>
        <Col>
            <Tabs
              defaultActiveKey="cameraView"
              id="uncontrolled-tab-example"
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
                  objectPointCount={lastObjectPointTimestamp}
                  filteredObjects={filteredObjects}
                />
              </Tab>
            </Tabs>
          <div style={{height: "30px"}}></div>
            <Tabs
              defaultActiveKey="capture"
              id="uncontrolled-tab-example"
            > 
              <Tab eventKey="capture" title="⏺ Capture">
                  <Capture mocapState={mocapState} objectPoints={objectPoints} objectPointErrors={objectPointErrors} lastObjectPointTimestamp={lastObjectPointTimestamp} />
              </Tab>
              <Tab eventKey="configure" title="⚙️ Configure">
                <Configure 
                  mocapState={mocapState}
                  cameraPoses={cameraPoses}
                  toWorldCoordsMatrix={toWorldCoordsMatrix}
                  objectPoints={objectPoints}
                  setCameraPoses={setCameraPoses}
                  setToWorldCoordsMatrix={setToWorldCoordsMatrix}
                  setParsedCapturedPointsForPose={setParsedCapturedPointsForPose}
                />
              </Tab>
            </Tabs>
          <div style={{height: "30px"}}></div>
        </Col>
      </Row>
    </Container>
  )
}
