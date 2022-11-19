import React from "react";
import { useCallback, useEffect, useState } from "react";
import { RgbColorPicker } from "react-colorful";
import useWebSocket from 'react-use-websocket';

import { Joystick } from "./Joystick";
import {
  apiUpdateActiveDotbotAddress, apiFetchActiveDotbotAddress,
  apiFetchDotbots, apiUpdateRgbLed,
  apiFetchLH2CalibrationState, apiApplyLH2Calibration, apiAddLH2CalibrationPoint
} from "./rest";


const websocketUrl = `${process.env.REACT_APP_DOTBOTS_WS_URL}/controller/ws/status`;
const inactiveAddress = "0000000000000000";


const DotBotRow = (props) => {

  return (
    <tr>
      <td>{`${props.dotbot.address}`}</td>
      <td>
      {
        props.dotbot.address === props.activeDotbot ? (
          <button className="badge text-bg-success text-light border-0" onClick={() => props.controlsClicked(props.dotbot.address)}>active</button>
        ) : (
          <button className="badge text-bg-primary text-light border-0" onClick={() => props.controlsClicked(props.dotbot.address)}>activate</button>
        )
      }
      </td>
    </tr>
  )
}

const DotBotsMapPoint = (props) => {
  let rgbColor = "rgb(0, 0, 0)"
  if (props.dotbot.rgb_led) {
    rgbColor = `rgb(${props.dotbot.rgb_led.red}, ${props.dotbot.rgb_led.green}, ${props.dotbot.rgb_led.blue})`
  }

  return (
    <>
    { (props.dotbot.address === props.active) &&
      <circle cx={parseFloat(props.dotbot.lh2_position.x)} cy={parseFloat(props.dotbot.lh2_position.y)} r="8" stroke="black" strokeWidth="2" fill="none" />
    }
    <circle cx={parseFloat(props.dotbot.lh2_position.x)} cy={parseFloat(props.dotbot.lh2_position.y)} r={props.dotbot.address === props.active ? 8: 5} opacity="80%" fill={rgbColor} />
    </>
  )
}

const DotBotsMap = (props) => {

  const [ calibrationFetched, setCalibrationFetched ] = useState(false);
  const [ calibrationState, setCalibrationState ] = useState("unknown");
  const [ pointsChecked, setPointsChecked ] = useState([false, false, false, false, false, false, false, false, false]);

  const fetchCalibrationState = useCallback(async () => {
    const state = await apiFetchLH2CalibrationState().catch((error) => console.error(error));
    setCalibrationState(state.state);
    setCalibrationFetched(true);
  }, [setCalibrationFetched, setCalibrationState]
  );

  const pointClicked = (index) => {
    let pointsCheckedTmp = pointsChecked.slice();
    pointsCheckedTmp[index] = true;
    setPointsChecked(pointsCheckedTmp);
    apiAddLH2CalibrationPoint(index);
  };

  const calibrateClicked = () => {
    if (["unknown", "done"].includes(calibrationState)) {
      setPointsChecked([false, false, false, false, false, false, false, false, false]);
      setCalibrationState("running");
    } else if (calibrationState === "ready") {
      setCalibrationState("done");
      apiApplyLH2Calibration();
    }
  };

  useEffect(() => {
    if (!calibrationFetched) {
      fetchCalibrationState();
    }
    if (pointsChecked.every(v => v === true)) {
      setCalibrationState("ready");
    }
  }, [calibrationFetched, fetchCalibrationState, pointsChecked, setCalibrationState]);

  let calibrationButtonLabel = "Start calibration";
  let calibrationButtonClass = "btn-primary";
  if (calibrationState === "running") {
    calibrationButtonLabel = <><span className="spinner-border spinner-border-sm text-light me-2 mt-1" role="status"></span>Calibration in progress...</>;
    calibrationButtonClass = "btn-secondary disabled";
  } else if (calibrationState === "ready") {
    calibrationButtonLabel = "Apply calibration";
    calibrationButtonClass = "btn-success";
  } else if (calibrationState === "done") {
    calibrationButtonLabel = "Update calibration";
  }

  return (
    <div className={`card m-1 ${props.dotbots && props.dotbots.length > 0 ? "visible" : "invisible"}`}>
      <div className="card-body justify-content-center">
        <div className="row">
          <div className="col d-flex justify-content-center">
            <div style={{ height: '401px', width: '401px' }}>
              <svg style={{ height: '401px', width: '401px'}}>
                <defs>
                  <pattern id="smallGrid" width="8" height="8" patternUnits="userSpaceOnUse">
                    <path d="M 8 0 L 0 0 0 8" fill="none" stroke="gray" strokeWidth="0.5"/>
                  </pattern>
                  <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
                    <rect width="80" height="80" fill="url(#smallGrid)"/>
                    <path d="M 80 0 L 0 0 0 80" fill="none" stroke="gray" strokeWidth="1"/>
                  </pattern>
                </defs>
                {/* Map grid */}
                <rect width="100%" height="100%" fill="url(#grid)" />
                {/* DotBots points */}
                {
                  props.dotbots && props.dotbots
                    .filter(dotbot => dotbot.lh2_position)
                    .map(dotbot => <DotBotsMapPoint key={dotbot.address} dotbot={dotbot} active={props.active}/>)
                }
                {
                  ["running", "ready"].includes(calibrationState) && (
                    <>
                    <rect x="160" y="160" width="10" height="10" fill={pointsChecked[0] ? "green" : "grey"} onClick={() => pointClicked(0)} />
                    <rect x="195" y="160" width="10" height="10" fill={pointsChecked[1] ? "green" : "grey"} onClick={() => pointClicked(1)} />
                    <rect x="230" y="160" width="10" height="10" fill={pointsChecked[2] ? "green" : "grey"} onClick={() => pointClicked(2)} />
                    <rect x="160" y="195" width="10" height="10" fill={pointsChecked[3] ? "green" : "grey"} onClick={() => pointClicked(3)} />
                    <rect x="195" y="195" width="10" height="10" fill={pointsChecked[4] ? "green" : "grey"} onClick={() => pointClicked(4)} />
                    <rect x="230" y="195" width="10" height="10" fill={pointsChecked[5] ? "green" : "grey"} onClick={() => pointClicked(5)} />
                    <rect x="160" y="230" width="10" height="10" fill={pointsChecked[6] ? "green" : "grey"} onClick={() => pointClicked(6)} />
                    <rect x="195" y="230" width="10" height="10" fill={pointsChecked[7] ? "green" : "grey"} onClick={() => pointClicked(7)} />
                    <rect x="230" y="230" width="10" height="10" fill={pointsChecked[8] ? "green" : "grey"} onClick={() => pointClicked(8)} />
                    </>
                  )
                }
              </svg>
            </div>
          </div>
        </div>
        <div className="row">
          <div className="col d-flex justify-content-center">
            <button className={`btn btn-sm m-1 ${calibrationButtonClass}`} onClick={calibrateClicked}>{calibrationButtonLabel}</button>
          </div>
        </div>
        {calibrationState === "running" && (
        <div className="d-flex justify-content-center">
          <p className="text-center" style={{ width: '400px' }}>
            Place a DotBot on the marks on the ground and once done, click the corresponding rectangle on the grid. Repeat the operation for each marks.
            Once all rectangles are green, click "Apply calibration".
          </p>
        </div>
        )}
      </div>
    </div>
  )
}

const DotBots = () => {
  const [ dotbots, setDotbots ] = useState();
  const [ activeDotbot, setActiveDotbot ] = useState(inactiveAddress);
  const [ color, setColor ] = useState({ r: 0, g: 0, b: 0 });

  const updateColor = useCallback((data, address) => {
    const dotbot = data.filter(db => db.address === address)[0];
    if (dotbot && dotbot.rgb_led) {
      setColor({r: dotbot.rgb_led.red, g: dotbot.rgb_led.green, b: dotbot.rgb_led.blue,});
    } else {
      setColor({r: 0, g: 0, b: 0,});
    }
  }, [setColor]
  );

  const updateActive = useCallback(async (address) => {
    await apiUpdateActiveDotbotAddress(address).catch((error) => console.error(error));
    setActiveDotbot(address);
    if (dotbots && address !== inactiveAddress) {
      updateColor(dotbots, address);
    }
  }, [dotbots, setActiveDotbot, updateColor]
  );

  const switchActive = async (address) => {
    let newAddress = address;
    if (address === activeDotbot) {
      newAddress = inactiveAddress
    }
    await updateActive(newAddress);
  };

  const fetchDotBots = useCallback(async () => {
    const data = await apiFetchDotbots().catch(error => console.log(error));
    setDotbots(data);
    const active = await apiFetchActiveDotbotAddress().catch(error => console.log(error));
    setActiveDotbot(active);
    if (data && active !== inactiveAddress) {
      updateColor(data, active);
    }
  }, [setDotbots, updateColor]
  );

  const onWsOpen = () => {
    console.log('websocket opened');
    fetchDotBots();
  };

  const onWsMessage = (event) => {
    const message = JSON.parse(event.data);

    if (message.cmd === "reload") {
      fetchDotBots();
    }
    if (message.cmd === "lh2_position" && dotbots && dotbots.length > 0) {
      let dotbotsTmp = dotbots.slice();
      for (let idx = 0; idx < dotbots.length; idx++) {
        if (dotbots[idx].address === message.address) {
          dotbotsTmp[idx].lh2_position = {x: message.x, y: message.y};
          setDotbots(dotbotsTmp);
        }
      }
    }
  };

  useWebSocket(websocketUrl, {
    onOpen: () => onWsOpen(),
    onClose: () => console.log("websocket closed"),
    onMessage: (event) => onWsMessage(event),
    shouldReconnect: (event) => true,
  });

  const applyColor = async () => {
    await apiUpdateRgbLed(activeDotbot, color.r, color.g, color.b);
    await fetchDotBots();
  }

  useEffect(() => {
    if (!dotbots) {
      fetchDotBots();
    }
  }, [dotbots, fetchDotBots]);

  const controlsVisible = activeDotbot !== inactiveAddress && dotbots && dotbots.filter(dotbot => dotbot.address === activeDotbot).length > 0;

  return (
    <>
    <nav className="navbar navbar-expand-lg bg-dark">
      <div className="container-fluid">
        <a className="navbar-brand text-light" href="http://www.dotbots.org">DotBots</a>
      </div>
    </nav>
    <div className="container">
      <div className="card m-1">
        <div className="card-header">Available DotBots</div>
        <div className="card-body p-0">
          <table id="table" className="table table-striped align-middle">
            <thead>
              <tr>
                <th>Address</th>
                <th>Controls</th>
              </tr>
            </thead>
            <tbody>
            {dotbots && dotbots.map(dotbot => <DotBotRow key={dotbot.address} dotbot={dotbot} activeDotbot={activeDotbot} controlsClicked={switchActive}/>)}
            </tbody>
          </table>
        </div>
      </div>
      <div className={`card m-1 ${controlsVisible ? "visible" : "invisible"}`}>
        <div className="card-body">
          <div className="row">
            <div className="col d-flex justify-content-center">
              <Joystick address={activeDotbot} />
            </div>
            <div className="col m-2">
              <div className="row">
                <div className="col">
                  <div className="d-flex justify-content-center">
                    <RgbColorPicker color={color} onChange={setColor} />
                  </div>
                </div>
              </div>
              <div className="col m-2">
                <div className="d-flex justify-content-center">
                  <button className="btn btn-primary m-1" onClick={applyColor}>Apply color</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <DotBotsMap dotbots={dotbots} active={activeDotbot} />
    </div>
    </>
  );
}

export default DotBots;
