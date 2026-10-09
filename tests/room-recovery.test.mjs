import test from 'node:test';import assert from 'node:assert/strict';
import {acceptRoomHeartbeat} from '../public/socket-transport.mjs';
import {makePrediction} from '../public/prediction.mjs';import {createState} from '../public/engine.mjs';
import {entryText} from '../public/experience-text.mjs';
test('wallet-return heartbeat clears old failure even while funding stays at frame zero',()=>{
 const room={failures:3,networkRecovering:true,lastReceived:100},prediction=makePrediction(),state=createState();
 for(let i=0;i<4;i++){assert.ok(prediction.queue(state,1000+i*450,40,0,0,0));assert.equal(acceptRoomHeartbeat(room,1000+i*450,40),i===0);assert.equal(room.failures,0);assert.equal(room.networkRecovering,false);assert.equal(room.lastRtt,40);prediction.flush(state);}
 assert.equal(room.lastReceived,2350);assert.equal(state[0],0);
});
test('connection recovery never marks deposits paid; waiting/funding and multilingual status stay distinct',()=>{
 const room={failures:1,payment:{paid:[false,false]}};assert.equal(acceptRoomHeartbeat(room,900,42),true);assert.deepEqual(room.payment.paid,[false,false]);assert.equal(acceptRoomHeartbeat(room,1000,45),false);assert.notEqual(entryText('fundingConnected'),entryText('roomConnected'));
});
