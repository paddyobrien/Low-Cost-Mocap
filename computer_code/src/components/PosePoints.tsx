import React, { useEffect, useRef } from 'react'

// That's how you define the value of a pixel
function drawPixel (canvasData, width, x, y, r, g, b, a) {
    var index = (x + y * width) * 4;
    
    canvasData.data[index + 0] = r;
    canvasData.data[index + 1] = g;
    canvasData.data[index + 2] = b;
    canvasData.data[index + 3] = a;
}

function numberOfAngles(point: [number, number][]){
    let notNull = 0;
    point.forEach((cam) => {
        if (cam[0] != null) {
            notNull++;
        }
    })
    return notNull;
}

const WIDTH = 320;

export default function PosePoints({numCams, points}:{numCams: number, points: Array<Array<Array<number>>>}){
  
  const canvasRef = useRef<HTMLCanvasElement>()
  useEffect(() => {
    const canvas = canvasRef.current!;
    if (numCams > 0) {
        const context = canvas.getContext('2d')!;
        context.clearRect(0, 0, canvas.width, canvas.height)
        context.fillStyle =  "#00FF00";
        console.log(points)
        points.forEach((point) => {
            let angles = numberOfAngles(point);
            console.log(angles)
            if (angles == numCams) {
                context.fillStyle =  "#00FF00";
            } else if (angles == numCams-1) {
                context.fillStyle = "#0000FF";
            } else {
                context.fillStyle = "#FF0000";
            }
            let offset = 0
            point.forEach((coords) => {
                if (coords[0] !== null) {
                    context.fillRect(coords[0] + offset - 1, coords[1] - 1, 4, 4);
                }
                offset += WIDTH;
            })
        });
    }
  }, [points, numCams])
  
  return <canvas style={{position: "absolute", left: 10, zIndex: 100}} ref={canvasRef} width={numCams * WIDTH} height={WIDTH}/>
}