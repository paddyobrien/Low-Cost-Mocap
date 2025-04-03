import { useEffect, useRef, useState } from 'react';
import { socket } from '../shared/styles/scripts/socket';
import { Button, Col, Overlay } from 'react-bootstrap';

const isValidJson = (str: string) => {
    try {
        const o = JSON.parse(str);
        if (o && typeof o === "object") {
            return true;
        }
    } catch (e) { }
    return false;
}

export default function CameraPoseCalibration({ cameraPoses, setParsedCapturedPointsForPose }: { cameraPoses: any, setParsedCapturedPointsForPose: (newPoints: unknown) => void }) {
    const target = useRef(null);
    const [overlayVisible, setOverlayVisible] = useState(false);
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
        <Button
            size="sm"
            className="me-3"
            variant="outline-secondary"
            ref={target}
            onClick={() => setOverlayVisible(!overlayVisible)}
        >Pose Calibration</Button>
        <Overlay target={target.current} show={overlayVisible} placement="top" rootClose={true} onHide={() => setOverlayVisible(false)}>
            <div className="overlay" style={{width: 600}}>
                <div>{countOfPointsForCameraPoseCalibration} points collected</div>
                <Button
                    size='sm'
                    variant="outline-primary"
                    disabled={false}
                    onClick={() => {
                        setCaptureNextPointForPose(true);
                    }
                    }>
                    Capture
                </Button>
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
            </div>
        </Overlay>
    </>
}