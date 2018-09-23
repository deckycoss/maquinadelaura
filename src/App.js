import React, { Component } from 'react';
import update from "immutability-helper";
import posed from "react-pose";
import './App.css';

const BehaviorEnum = Object.freeze({
    TriggerLeft: 1,
    TriggerUp: 2,
    TriggerRight: 3,
    TriggerDown: 4,
    TriggerForward: 5,
    TriggerBackward: 6,
    TriggerCounterClockwise: 7,
    TriggerClockwise: 8,
})

function relativeDirectionToAbsolute(fromAbsolute, toRelative){

    // assumes BehaviorEnum absolute directions are 1 to 4 in clockwise order

    // if toRelative is actually an absolute direction, return it unchanged
    if (toRelative < 5 && toRelative > 0) {
        return toRelative;
    }
    // if fromAbsolute is not absolute, return undefined
    else if (fromAbsolute < 1 || fromAbsolute > 4){
        return;
    }

    var result;

    switch (toRelative){
        case BehaviorEnum.TriggerForward:
            result = fromAbsolute;
            break;
        case BehaviorEnum.TriggerBackward:
            result = (fromAbsolute + 2) % 4 || 4;
            break;
        case BehaviorEnum.TriggerClockwise:
            result = (fromAbsolute + 1) % 4 || 4;
            break;
        case BehaviorEnum.TriggerCounterClockwise:
            result = (fromAbsolute + 3) % 4 || 4;
            break;
    }

    return result;
}

function newCellData(){
    return {
        isPlaying: false,
        behaviors: {
            onTriggerByPress: [
                // Math.ceil(Math.random() * BehaviorEnum.TriggerDown)
                BehaviorEnum.TriggerRight,
                BehaviorEnum.TriggerLeft
            ],
            onTriggerByCell: [
                BehaviorEnum.TriggerClockwise
            ]
        }
    };
}

class App extends Component {
    render() {
        return (
          <div className="App">
            <p>Hello world!</p>
            <Matrix width="600px" height="600px" numRows={5} numCols={5}/>
          </div>
        );
    }
}

class Matrix extends Component {

    constructor(props) {
        super(props);

        let _state = {queue: [], isPlaying: false, tempo: 100};
        for (let i = 0; i < this.props.numRows; i++){
            // let row = {};
            for (let j = 0; j < this.props.numCols; j++){
                _state[(i * this.props.numCols) + j] = newCellData();
            }
            // _state[i] = row;
        }
        this.state = _state;
        this.handleCellPress = this.handleCellPress.bind(this);
        this.playStep = this.playStep.bind(this);
        this.toggleTimer = this.toggleTimer.bind(this);
        this.setTempoFromForm = this.setTempoFromForm.bind(this);
    }

    componentWillUnmount() {
        this.stopTimer();
    }

    setTimer(tempo) {
        if (! tempo){
            return;
        }
        this.timerID = setInterval(() => this.playStep(), (6 / tempo) * 2500);
    }

    clearTimer(){
        clearInterval(this.timerID);
    }

    startTimer() {
        if (this.state.isPlaying){
            return false;
        }

        this.setTimer(this.state.tempo);
        this.setState({isPlaying: true});

        return true;
    }

    stopTimer() {
        this.clearTimer();
        this.setState({isPlaying: false});
    }

    toggleTimer() {
        if (! this.startTimer()){
            this.stopTimer();
        }
    }

    setTempoFromForm(e) {
        let tempo = parseFloat(e.target.value);
        if (isNaN(tempo)){
            return;
        }

        this.setState((prevState) => {
            // we have to clear and set the intervals directly instead of using
            // startTimer or stopTimer, since those wrappers rely on potentially
            // outdated state
            this.clearTimer();

            if (prevState.isPlaying){
                this.setTimer(tempo);
            }

            return {tempo}
        });
    }

    handleCellPress(cell, e){
        let index = (cell.props.row * this.props.numCols) + cell.props.col;

        this.setState((prevState) => {
            return update(prevState, {
                queue: {$push: [{triggeredByIndex: -1, index}]}
            });
        });
        // this.triggerCell(index, true);
    }

    playStep(){
        this.setState((prevState) => {
            let newState = {};
            let newQueue = [];
            let cellsToSetActive = {};

            for (let k in prevState.queue){
                let index = prevState.queue[k].index;
                let triggeredByIndex = prevState.queue[k].triggeredByIndex;

                let prevCellState = prevState[index];
                let behaviors = prevCellState.behaviors[(triggeredByIndex < 0) ? "onTriggerByPress" : "onTriggerByCell"];

                for (let i in behaviors){
                    let cellToQueue = -1;

                    // if triggered by a press, relative directions are
                    // meaningless, so use behavior as is. if triggered by
                    // another cell, and the behavior to respond with is a
                    // relative direction, convert that to an absolute direction

                    let absoluteBehavior = (triggeredByIndex < 0) ? behaviors[i] :
                                           relativeDirectionToAbsolute(prevState.queue[k].triggeredByDirection, behaviors[i]);

                    // determine which neighbours, if any, should be triggered
                    // on the next cycle

                    switch (absoluteBehavior){
                        case BehaviorEnum.TriggerLeft:
                            cellToQueue = (index % this.props.numCols) ? index - 1 : cellToQueue;
                            break;
                        case BehaviorEnum.TriggerRight:
                            cellToQueue = (index % this.props.numCols !== this.props.numCols - 1) ? index + 1 : cellToQueue;
                            break;
                        case BehaviorEnum.TriggerUp:
                            cellToQueue = (index >= this.props.numCols) ? index - this.props.numCols : cellToQueue;
                            break;
                        case BehaviorEnum.TriggerDown:
                            cellToQueue = (index < (this.props.numRows - 1) * this.props.numCols) ? index + this.props.numCols : cellToQueue;
                            break;
                    }

                    if (cellToQueue >= 0){
                        newQueue.push({index: cellToQueue, triggeredByIndex: index, triggeredByDirection: absoluteBehavior});
                    }
                }

                cellsToSetActive[index] = true;
            }
            
            for (let i = 0; i < this.props.numRows * this.props.numCols; i++){

                let prevCellState = prevState[i];

                if (cellsToSetActive[i]) {
                    newState[i] = update(prevCellState, {
                        isPlaying: {$set: true}
                    });
                }

                else if (prevCellState.isPlaying) {
                    newState[i] = update(prevCellState, {
                        isPlaying: {$set: false}
                    });
                }
            }

            newState.queue = newQueue;
            return newState;
        });
    }

    render() {

        let cells = [];

        for (let i = 0; i < this.props.numRows; i++){
            for (let j = 0; j < this.props.numCols; j++){
                cells.push(
                    <Cell row={i} col={j}
                    key={i.toString() + "-" + j.toString()}
                    onPress={this.handleCellPress}
                    isActive={this.state[(i * this.props.numCols) + j].isPlaying}
                    />
                );
            }
        }


        return (
            <div>
                <svg className="Matrix" width={this.props.width} height={this.props.height}>
                    { cells }
                </svg>
                <br/>
                <button onClick={this.playStep}>next step</button>
                <button onClick={this.toggleTimer}>
                    {(this.state.isPlaying) ? "stop" : "start"}
                </button>
                <input type="text" value={this.state.tempo} onChange={this.setTempoFromForm}/>
            </div>
        )
    }
}

class Cell extends Component {

    constructor(props) {
        super(props);

        this.getPos = this.getPos.bind(this);
        this.handlePress = this.handlePress.bind(this);
        // this.state = {myState: false};
    }

    getPos() {
        return {x: this.props.col * 15, y: this.props.row * 15};
    }

    handlePress(e) {
        // this.setState((prevState) => ({
        //     myState: ! prevState.myState
        // }));
        this.props.onPress(this, e);
    }

    render() {
        let pos = this.getPos();
        
        return (
            <Box
            x={pos.x.toString() + "%"}
            y={pos.y.toString() + "%"}
            width="10%"
            height="10%"
            pose={(this.props.isActive) ? "active" : "inactive"}
            fillActive="#aaff70"
            fillInactive="#3333ff"
            onMouseDown={this.handlePress}
            />
        )
    }
}

const Box = posed.rect({
    inactive: {
        fill: ({fillInactive}) => fillInactive,
    },
    active: {
        fill: ({fillActive}) => fillActive,
        transition: {
            flip: 1,
        },
    },
    props: {fillActive: "#fff", fillInactive: "#000"}
})

export default App;
