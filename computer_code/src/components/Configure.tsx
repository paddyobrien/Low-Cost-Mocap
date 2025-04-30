import { Button, Col, Container, Form, Row, Tab, Tabs } from "react-bootstrap"
import CameraPoseCalibration from "./CameraPoseCalibration"
import { socket } from "../lib/socket"
import { States } from "../lib/states"
import { useRef } from "react"

interface Props {
    mocapState: States,
    cameraPoses: any,
    toWorldCoordsMatrix: any,
    setCameraPoses: (s: any) => void,
    setToWorldCoordsMatrix: (s: any) => void
    setParsedCapturedPointsForPose: (s: Array<Array<Array<number>>>) => void
}

export default function Configure({
    mocapState,
    cameraPoses,
    toWorldCoordsMatrix,
    setCameraPoses,
    setToWorldCoordsMatrix,
    setParsedCapturedPointsForPose,
}: Props) {
    const isTriangulatingPoints = mocapState >= States.Triangulation;
    // TODO - Capture object points
    const objectPoints = useRef([])
    return (
        <Container fluid={true}>
            <Row>
                <Col>
                    Current camera poses:
                        <Form.Control
                            value={JSON.stringify(cameraPoses)}
                            onChange={(event) => setCameraPoses(JSON.parse(event.target.value))}
                            />
                </Col>
            </Row>
            <Row>
                <Col xs={4} className='pt-2'>
                Current To World Matrix:
                <Form.Control
                value={JSON.stringify(toWorldCoordsMatrix)}
                onChange={(event) => setToWorldCoordsMatrix(JSON.parse(event.target.value))}
                />
            </Col>
            </Row>
            <Row className="mt-2">
                <Col>
                    <Tabs
                    defaultActiveKey="pose"
                    id="uncontrolled-tab-example"
                    className="mb-3"
                    > 
                        <Tab eventKey="pose" title="Calibrate pose">
                            <CameraPoseCalibration cameraPoses={cameraPoses} setParsedCapturedPointsForPose={setParsedCapturedPointsForPose} />
                        </Tab>
                        <Tab eventKey="scale" title="Set scale">
                            <Button
                                size='sm'
                                className="mr-2"
                                variant="outline-secondary"
                                disabled={!isTriangulatingPoints && objectPoints.current.length == 0}
                                onClick={() => {
                                    socket.emit("determine-scale", { objectPoints: objectPoints.current, cameraPoses: cameraPoses })
                                }
                            }>
                                Set scale
                            </Button>
                        </Tab>
                        <Tab eventKey="align" title="Align">
                            <Button
                                size='sm'
                                variant="outline-secondary"
                                disabled={!isTriangulatingPoints && objectPoints.current.length == 0}
                                onClick={() => {
                                    socket.emit("acquire-floor", { objectPoints: objectPoints.current, cameraPoses, toWorldCoordsMatrix })
                                }
                            }>
                                Acquire Floor
                            </Button>
                        </Tab>
                        <Tab eventKey="origin" title="Set origin">
                            <Button
                                size='sm'
                                className="mr-2"
                                variant="outline-secondary"
                                disabled={!isTriangulatingPoints && objectPoints.current.length == 0}
                                onClick={() => {
                                    socket.emit("set-origin", { objectPoint: objectPoints.current[0][0], toWorldCoordsMatrix })
                                }
                                }>
                                Set origin
                            </Button>
                        </Tab>
                    </Tabs>
                </Col>
            </Row>
        </Container>
    )
}