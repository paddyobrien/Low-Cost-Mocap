import { useEffect, useRef, useState } from 'react';
import { socket } from '../lib/socket';
import { Button, Col, Container, Overlay, Row } from 'react-bootstrap';

const isValidJson = (str: string) => {
    try {
        const o = JSON.parse(str);
        if (o && typeof o === "object") {
            return true;
        }
    } catch (e) { }
    return false;
}

interface Props { 
    cameraPoses: any,
    setParsedCapturedPointsForPose: (newPoints: unknown) => void
}

export default function CameraPoseCalibration({ cameraPoses, setParsedCapturedPointsForPose }: Props) {
    const [captureNextPointForPose, setCaptureNextPointForPose] = useState(false)
    const [capturedPointsForPose, setCapturedPointsForPose] = useState("");
    useEffect(() => {
        const handler = (data: any) => {
            if (captureNextPointForPose) {
                const newVal = `${capturedPointsForPose}${JSON.stringify(data)},`;
                setCapturedPointsForPose(newVal);
                setParsedCapturedPointsForPose(JSON.parse(`[${newVal.slice(0, -1)}]`))
                setCaptureNextPointForPose(false);
            }
        }
        socket.on("image-points", handler)

        return () => {
            socket.off("image-points", handler)
        }
    }, [capturedPointsForPose, captureNextPointForPose])
    const calculateCameraPose = async (cameraPoints: Array<Array<Array<number>>>) => {
        socket.emit("calculate-camera-pose", { cameraPoints })
    }

    const calculateBundleAdjustment = async (cameraPoints: Array<Array<Array<number>>>) => {
        socket.emit("calculate-bundle-adjustment", { cameraPoints, cameraPoses })
    }

    const countOfPointsForCameraPoseCalibration = isValidJson(`[${capturedPointsForPose.slice(0, -1)}]`) ? JSON.parse(`[${capturedPointsForPose.slice(0, -1)}]`).length : 0;
    return <>
        <Container fluid={true}>
            <Row>
                <Col><Button
                    size='sm'
                    variant="outline-primary"
                    disabled={false}
                    onClick={() => {
                        setCaptureNextPointForPose(true);
                    }
                    }>
                    Capture point
                </Button></Col>
            </Row>
            <Row>
                <Col>
                    <p>Pose calibration determines the translation and rotation of the cameras relative to each other. </p>
                    <p>The calibration procedure is as follows:</p>
                    <ol>
                        <li>Turn on <em>one</em> light on the tracker object.</li>
                        <li>Place the object in the scene where it can be seen by multiple cameras.</li>
                        <li>Enable <em>Point detection</em></li>
                        <li>Press the <em>Capture point</em> button. The captured point will be displayed on the camera feed. A green point indicates the point was visible to all cameras, a blue point was visible to n-1 cameras and a red point was visible to n-2 cameras.</li>
                        <li>Repeat until at least 10-20 points are captured. Try to cover as much of the image as possible with points.</li>
                        <li>Once happy with points, click on either "Full Pose" or "Bundle Adjustment". A full pose is necessary if you do not have an existing camera pose that is close to your camera arrangement. A bundle adjustment is preferred if there is an existing camera pose that is close.</li>
                    </ol>
                
                </Col>
            </Row>
        </Container>
                <div>{countOfPointsForCameraPoseCalibration} points collected</div>
                
                <Button
                    size='sm'
                    className=""
                    variant="outline-primary"
                    disabled={countOfPointsForCameraPoseCalibration === 0}
                    onClick={() => {
                        calculateCameraPose(JSON.parse(`[${capturedPointsForPose.slice(0, -1)}]`))
                    }}>
                    Full camera pose
                </Button>
                <Button
                    size='sm'
                    className=""
                    variant="outline-primary"
                    disabled={countOfPointsForCameraPoseCalibration === 0}
                    onClick={() => {
                        calculateBundleAdjustment(JSON.parse(`[${capturedPointsForPose.slice(0, -1)}]`))
                    }}>
                    Bundle Adjustment
                </Button>
                <Button
                    size='sm'
                    variant="outline-danger"
                    disabled={countOfPointsForCameraPoseCalibration === 0}
                    onClick={() => {
                        setCapturedPointsForPose("")
                        setParsedCapturedPointsForPose([]);
                    }}>
                    Clear
                </Button>
                </>
}