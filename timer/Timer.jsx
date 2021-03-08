import React, {useEffect, useState, useRef} from "react";

const Timer = ({minutes}) => {

    const [timer, setTimer] = useState(1);
    const tick = 1/(minutes*60);
    const interval = React.useRef(null)
    const style={
        background:'red',
        height: '100%',
    }
    useEffect(() => {
        interval.current = setInterval(() => {
            setTimer((prev) => {
                return prev - tick
            });
        }, 1000)
        return () => {
            clearTimeout(interval.current)
        }
    }, [])

    return (
        <>
        <div style={{...style, width: `${100*timer}%`}}>&nbsp;</div>
        </>
    )
};

export default Timer;
