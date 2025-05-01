import { Button, Col, Container, Form, Row, Tab, Tabs } from "react-bootstrap"
import CameraPoseCalibration from "./CameraPoseCalibration"
import { socket } from "../lib/socket"
import { Modes } from "../lib/modes"
import { MutableRefObject, useRef } from "react"
import SmallHeader from "./SmallHeader"
import ScaleCalibration from "./ScaleCalibration"
import AlignmentCalibration from "./AlignmentCalibration"
import OriginCalibration from "./OriginCalibration"

interface Props {
    mocapMode: Modes,
    cameraPoses: any,
    toWorldCoordsMatrix: any,
    objectPoints: MutableRefObject<number[][][]>,
    setCameraPoses: (s: any) => void,
    setToWorldCoordsMatrix: (s: any) => void
    setParsedCapturedPointsForPose: (s: Array<Array<Array<number>>>) => void
}

export default function Configure({
    mocapMode,
    cameraPoses,
    toWorldCoordsMatrix,
    objectPoints,
    setCameraPoses,
    setToWorldCoordsMatrix,
    setParsedCapturedPointsForPose,
}: Props) {
    const isTriangulatingPoints = mocapMode >= Modes.Triangulation;
    return (
        <Container fluid={true} className="p-2 shadow-lg container-card">
            <Row>
                <Col>
                    <SmallHeader>Current camera pose</SmallHeader>
                    <Form.Control
                        value={JSON.stringify(cameraPoses)}
                        onChange={(event) => setCameraPoses(JSON.parse(event.target.value))}
                    />
                </Col>
            </Row>
            <Row className="mb-4">
                <Col xs={4} className='pt-2'>
                    <SmallHeader>Current To World Matrix:</SmallHeader>
                    <Form.Control
                        value={JSON.stringify(toWorldCoordsMatrix)}
                        onChange={(event) => setToWorldCoordsMatrix(JSON.parse(event.target.value))}
                    />
                </Col>
            </Row>
            <Row>
                <Col>
                    <Tabs
                        defaultActiveKey="pose"
                        id="uncontrolled-tab-example"
                    >
                        <Tab eventKey="pose" title="📍Calibrate pose">
                            <CameraPoseCalibration 
                                mocapMode={mocapMode}
                                cameraPoses={cameraPoses}
                                setParsedCapturedPointsForPose={setParsedCapturedPointsForPose} 
                            />
                        </Tab>
                        <Tab eventKey="scale" title="📏 Set scale">
                            <ScaleCalibration 
                                mocapMode={mocapMode}
                                cameraPoses={cameraPoses}
                                objectPoints={objectPoints}
                            />
                        </Tab>
                        <Tab eventKey="align" title="→ Align">
                            <AlignmentCalibration
                                mocapMode={mocapMode}
                                cameraPoses={cameraPoses}
                                toWorldCoordsMatrix={toWorldCoordsMatrix}
                                objectPoints={objectPoints}
                            />
                        </Tab>
                        <Tab eventKey="origin" title="Ｘ Set origin">
                            <OriginCalibration 
                                mocapMode={mocapMode}
                                cameraPoses={cameraPoses}
                                toWorldCoordsMatrix={toWorldCoordsMatrix}
                                objectPoints={objectPoints}
                            />
                        </Tab>
                    </Tabs>
                </Col>
            </Row>
        </Container>
    )
}