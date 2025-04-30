import { Container, Badge, Button, Col, Row } from 'react-bootstrap';
import PosePoints from "./PosePoints"
import { useCallback, useState } from 'react';
import useSocketListener from '../hooks/useSocketListener';
import { States } from '../lib/states';
import changeState from '../lib/changeState';
import CameraSettings from './CameraSettings';
import InfoTooltip from './InfoTooltip';

const BASEURL = "http://localhost:3001/api/camera-stream";

interface Props {
    mocapState: States,
    parsedCapturedPointsForPose: any
}

const ALL_CAMS = "all"

export default function CameraView({mocapState, parsedCapturedPointsForPose}: Props) {
    const [fps, setFps] = useState(0);
    const [numCams, setNumCams] = useState(0);
    useSocketListener("fps", data => {
        setFps([data["fps"]])
    })
    useSocketListener("num-cams", setNumCams)
    
    const processingEnabled = mocapState >= States.ImageProcessing;
    const pointCaptureEnabled = mocapState >= States.PointCapture;
    const triangulationEnabled = mocapState >= States.Triangulation;

    return (
        <Container fluid={true}>
            <Row>
                <Col>
                    <CameraSettings />
                    <InfoTooltip disabled={mocapState === States.CamerasFound} message="Image processing must be disabled">
                        <Button
                            size="sm"
                            className="me-3"
                            variant="outline-secondary"
                            onClick={() => changeState(States.SaveImage)}
                            disabled={mocapState !== States.CamerasFound}
                        >
                        📸 Capture frame
                        </Button>
                    </InfoTooltip>
                </Col>
                <Col style={{ textAlign: "right" }}>
                    <Badge style={{ minWidth: 80 }} bg={fps < 25 ? "danger" : fps < 60 ? "warning" : "success"}>FPS: {fps}</Badge>
                </Col>
            </Row>
            <Row className='mt-2 mb-1' style={{ height: "320px" }}>
                <Col style={{ "position": "relative", paddingLeft: 10 }}>
                    <img src={`${BASEURL}`} />
                    <PosePoints numCams={numCams} points={parsedCapturedPointsForPose} />     
                </Col>
            </Row>
            <Row>
                <Col>
                    <Button
                        size="sm"
                        className="mr-2"
                        variant="outline-secondary"
                        disabled={mocapState > States.ImageProcessing}
                        onClick={() => changeState(mocapState === States.CamerasFound ? States.ImageProcessing : States.CamerasFound)}
                    >{processingEnabled ? "⏹️ Stop Image Processing": "🎆 Enable Image Processing"}</Button>
                    <Button
                        size="sm"
                        className="mr-2"
                        variant="outline-secondary"
                        disabled={mocapState < States.ImageProcessing || mocapState > States.PointCapture}
                        onClick={() => changeState(mocapState === States.PointCapture ? States.ImageProcessing : States.PointCapture)}
                    >{pointCaptureEnabled ? "⏹️ Stop Point Capture": "👉 Enable Point Capture"}</Button>
                    <Button
                        size="sm"
                        className="mr-2"
                        variant="outline-secondary"
                        disabled={mocapState < States.PointCapture || mocapState > States.Triangulation}
                        onClick={() => changeState(mocapState === States.PointCapture ? States.Triangulation : States.PointCapture)}
                    >{triangulationEnabled ? "⏹️ Stop Triangulating": "◢ Enable Triangulation"}</Button>
                </Col>
            </Row>
        </Container>
    )
}