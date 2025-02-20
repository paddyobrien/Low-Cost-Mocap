import { useCallback, useEffect, useState } from "react"
import { socket } from "../shared/styles/scripts/socket";
import { Button } from "react-bootstrap";

function createCSV(filename: string, data: [][]) {
    const link = document.createElement('a');
    link.style.display = 'none';
    document.body.appendChild(link);
    const fileContents = data.map((row) => {
        return `${row.join(",")}\n`
    })

    const blob = new Blob([fileContents], { type: 'text/plain' });

    const objectURL = URL.createObjectURL(blob);

    link.href = objectURL;
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.txt`;
    link.click();
}

export default function RecordingControls({ objectPoints }) {

    return <>{objectPoints.current?.length > 0 && <Button
        size="sm"
        className="me-3"
        variant="outline-primary"
        onClick={() => {
            createCSV("results", objectPoints.current);
        }}
    >
        Download points
    </Button>}
    </>
}