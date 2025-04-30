import { MutableRefObject, useEffect, useState } from "react"
import { Button, Col, Container, Row } from "react-bootstrap"
import InfoTooltip from "./InfoTooltip"
import { socket } from "../lib/socket"
import { States } from "../lib/states"
import SmallHeader from "./SmallHeader"

interface Props {
    mocapState: States,
    cameraPoses: any,
    objectPoints: MutableRefObject<number[][][]>,
}

export default function ScaleCalibration({mocapState, cameraPoses, objectPoints}: Props) {
    const [captureNextPoint, setCaptureNextPoint] = useState(false)
    useEffect(() => {
        objectPoints.current = [];
    })
    useEffect(() => {
        socket.on("object-points", (data) => {
            if (captureNextPoint) {
                objectPoints.current.push(data["object_points"])
            }
        })
    
        return () => {
          socket.off("object-points")
        }
      }, [captureNextPoint])
    const objectPointsEnabled = mocapState >= States.Triangulation
    const countOfPoints = objectPoints.current.length
    return (
        <Container fluid={true} className="container-card">
            <Row className="pt-2">
                <Col>
                <InfoTooltip disabled={objectPointsEnabled} message="Enable triangulation to record points">
                    <Button
                        size='sm'
                        variant="outline-primary"
                        className="mr-2"
                        disabled={!objectPointsEnabled}
                        onClick={() => {
                            setCaptureNextPoint(true);
                        }
                    }>
                        Record point
                    </Button>
                </InfoTooltip>
                <InfoTooltip disabled={countOfPoints > 0} message="No points recorded">
                    <Button
                        size='sm'
                        variant="outline-danger"
                        disabled={countOfPoints === 0}
                        onClick={() => {
                            objectPoints.current = [];
                        }
                    }>
                        Clear {countOfPoints} points
                    </Button>
                </InfoTooltip>
                </Col>
            </Row>
            <Row>
                <Col>
                    <SmallHeader>Recorded points</SmallHeader>
                    <pre style={{border: "1px solid", height: 300, overflowY: "auto"}}>
                        {JSON.stringify(objectPoints.current, null, 2)}
                    </pre>
                </Col>
            </Row>
            <Row>
                <Col>
                <details>
                    <summary>Calibration procedure</summary>
                    <p>Use this procedure to set the scale of the world so that distances are valid.</p>
                    <ol>
                        <li>Turn on <em>both</em> lights on the tracker object.</li>
                        <li>Place the object in the scene where it can be seen by multiple cameras.</li>
                        <li>Enable <em>Triangulation</em></li>
                        <li>To ensure pose calibration is correct look at the camera feed and verify that the epipolar lines are intersecting both dots from all cameras</li>
                        <li>Press the <em>Record point</em> button.</li>
                        <li>Repeat for several points at different locations in the scene.</li>
                        <li>Once happy with points, click on <em>Set scale</em></li>
                    </ol>
                </details>
                </Col>
            </Row>
            <Row>
                <Col>
                    <Button
                        size='sm'
                        className="mr-2"
                        variant="outline-primary"
                        disabled={countOfPoints == 0}
                        onClick={() => {
                            socket.emit("determine-scale", { objectPoints: objectPoints.current, cameraPoses: cameraPoses })
                        }
                    }>
                        Set scale
                    </Button>
                </Col>
            </Row>
        </Container>
    )
}