// Command list is shared by the page and route validation tests.
// Numbers are move costs, not a promise that a route lands at every distance.
export const COMBOS=Object.freeze([
 {id:'ground-three',group:'ground',type:-1,name:'三段起手',keys:'J → J → J',cost:0,note:'连续点按；第三段横向击退约一个身位。'},
 {id:'ground-burst',group:'ground',type:-1,name:'地面爆发',keys:'J → H → E → I',cost:100,note:'每次命中后接下一招；蓄势可被打断。'},
 {id:'launcher-air',group:'ground',type:-1,name:'升龙追击',keys:'W＋J → K → J → J → H',cost:20,note:'升龙命中后跳跃追击，空中重击击落。'},
 {id:'dash-turn',group:'ground',type:-1,name:'穿身反打',keys:'L → A/D＋J → H',cost:8,note:'闪避第6帧后回身攻击，无敌随接招结束，命中接重击。'},
 {id:'air-three',group:'air',type:-1,name:'空中三连',keys:'K → J → J → J',cost:0,note:'空中前两段均需命中，第三段击落。'},
 {id:'air-shot',group:'air',type:-1,name:'浮空射击',keys:'K → J → J → U',cost:12,note:'空中第二段命中后释放定向弹丸。'},
 {id:'air-heavy',group:'air',type:-1,name:'空中重击终结',keys:'K → J → J → H',cost:0,note:'二段命中接重击，向下击落对手。'},
 {id:'air-burst',group:'air',type:-1,name:'空中爆发',keys:'K → J → J → E → I',cost:100,note:'二段与特殊技需命中；至少保留70能量给必杀。'},
 {id:'air-dash',group:'air',type:-1,name:'空中突袭',keys:'K → L → A/D＋J → H',cost:8,note:'跳至半空再闪避；第6帧回身接招，接近落地时会错失空中攻击。'},
 {id:'air-super',group:'air',type:-1,name:'空中必杀',keys:'K → I',cost:70,note:'直接发动空中必杀，可被打断；不会自动转向。'},
 {id:'ember-air-small',group:'air',type:0,name:'焰翼连踢',keys:'K → J → O → E',cost:45,note:'轻击命中接焰翼冲掌，冲掌命中接焰陨连踢。'},
 {id:'frost-air-small',group:'air',type:1,name:'月轮追击',keys:'K → J → O → E',cost:45,note:'轻击接月轮追刃，近距刃命中后接回天双月。'},
 {id:'ember-finish',group:'ground',type:0,name:'赤莲终结',keys:'O → I',cost:85,note:'焰掌命中接赤莲焚城；贴近并面向对手。'},
 {id:'frost-finish',group:'ground',type:1,name:'霜月终结',keys:'O → I',cost:85,note:'月刃命中接永夜冰葬；保持施放距离。'}
]);
// -1 is a real jump, 10 is a dodge; every other step requires an unguarded hit.
export const ROUTE_STEPS=Object.freeze({
 'ground-three':[1,13,14], 'ground-burst':[1,2,3,12],
 'launcher-air':[20,-1,5,15,6], 'dash-turn':[10,1,2],
 'air-three':[-1,5,15,16], 'air-shot':[-1,5,15,4],
 'air-heavy':[-1,5,15,6], 'air-burst':[-1,5,15,17,19],
 'air-dash':[-1,10,5,6], 'air-super':[-1,19],
 'ember-air-small':[-1,5,18,17], 'frost-air-small':[-1,5,18,17],
 'ember-finish':[11,12], 'frost-finish':[11,12]
});
