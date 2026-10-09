export function language(win=globalThis.window){
 let requested;try{requested=new URL(win.location.href).searchParams.get('lang');}catch{}
 if(requested==='en'||requested==='zh')return requested;
 try{return win.localStorage.getItem('tapeoutscan.language.v1')==='en'?'en':'zh';}catch{return 'zh';}
}
export const TEXT={
 zh:{preview:'请从正式 HTTPS 游戏入口连接钱包。',guide:'游玩指引',installTitle:'从主屏幕打开，操作更顺手',installText:'手机浏览器可能把滑动当成翻页或选字。建议添加到主屏幕；也可以了解风险后继续。',tutorial:'查看添加教程',continue:'了解风险，继续游玩',done:'知道了',rotateTitle:'试试横屏游玩',rotateText:'关闭手机方向锁，再把手机横过来。网页 App 也可以继续竖屏操作。',portrait:'继续竖屏',walletTitle:'连接并登录 X Layer',walletGuide:'1 连接钱包 → 2 确认登录签名。确认后返回原来的游戏窗口。登录不会支付或授权代币。',appReturn:'从主屏幕打开的玩家，请切回这个网页 App；普通浏览器玩家请切回原标签页。',walletLater:'稍后连接',connect:'连接并登录 OKX',openWallet:'继续打开 OKX',disconnect:'退出钱包',connected:'已登录 · X Layer',idle:'免费联机无需钱包；押金对战需要连接并登录。',loading:'正在准备钱包…',connecting:'1 / 2 · 请在钱包确认连接',switching:'请在钱包切换到 X Layer',signing:'2 / 2 · 请确认登录签名，然后返回游戏',verifying:'正在完成登录…',loginRequired:'押金对战需要连接钱包并确认登录签名，也可以返回免费模式。',LOGIN_REQUIRED:'登录已过期，请重新连接。',WRONG_NETWORK:'请切换到 X Layer（196）后继续。',WALLET_CHANGED:'钱包或网络已变化，请重新登录。',LOGIN_EXPIRED:'本次登录已过期，请重试。',INVALID_SIGNATURE:'签名核验未通过，请使用刚才连接的钱包。',TOO_MANY_REQUESTS:'操作较频繁，请稍后再试。',ORIGIN_DENIED:'当前游戏网址尚未开通登录，请从正式游戏入口进入。',cancelled:'已取消登录，可再次连接。',pending:'钱包已有请求，请打开 OKX 完成。',unavailable:'未检测到浏览器钱包。手机可通过 OKX App 登录；电脑请启用 OKX 扩展。',network:'网络暂不可用，请重试。',timeout:'登录等待超时，请检查钱包后重试。',mobileHint:'连接和签名是钱包的两次确认。游戏会自动接续；如果没有弹出，请点下方“打开 OKX”继续当前步骤。',ready:'准备 · 可试按操作键',walletLabel:'钱包登录',ios1:'在 Safari 打开当前游戏页面，点分享按钮。',ios2:'选择“添加到主屏幕”，确认添加。',ios3:'从主屏幕的「余烬」图标打开，关闭方向锁后横屏。',android1:'在 Chrome 打开当前游戏页面，点右上角 ⋮。',android2:'选择“添加到主屏幕”或“安装应用”，确认添加。',android3:'从主屏幕打开「余烬」，启用自动旋转后横屏。',returnGame:'完成后返回游戏',guideButton:'横屏 / 网页 App 指引',guest:'暂不登录',walletClose:'关闭钱包',waiting:'等待对手 · 可试按操作键',trial:'熟悉操作键',back:'返回准备'},
 en:{preview:'Use the official HTTPS game entry to connect a wallet.',guide:'Play guide',installTitle:'Play from your Home Screen',installText:'A browser may interpret swipes as scrolling or text selection. Add the game to your Home Screen, or continue with this risk.',tutorial:'Show setup guide',continue:'Understand and continue',done:'Got it',rotateTitle:'Try landscape mode',rotateText:'Turn off orientation lock and rotate your phone. Portrait play is also available in the web app.',portrait:'Continue in portrait',walletTitle:'Sign in on X Layer',walletGuide:'1 Connect wallet → 2 Sign in. Return to this game after confirming. Login does not pay or approve tokens.',appReturn:'Home Screen players: return to this web app. Browser players: return to the same tab.',walletLater:'Later',connect:'Connect & sign in with OKX',openWallet:'Continue in OKX',disconnect:'Sign out',connected:'Signed in · X Layer',idle:'Free online play needs no wallet. Sign in for deposit matches.',loading:'Preparing wallet…',connecting:'1 / 2 · Confirm wallet connection',switching:'Switch to X Layer in your wallet',signing:'2 / 2 · Sign in, then return to the game',verifying:'Completing sign-in…',loginRequired:'Sign in for a deposit match, or return to free mode.',LOGIN_REQUIRED:'Session expired. Please sign in again.',WRONG_NETWORK:'Switch to X Layer (196) to continue.',WALLET_CHANGED:'Wallet or network changed. Please sign in again.',LOGIN_EXPIRED:'This login expired. Please try again.',INVALID_SIGNATURE:'Signature check failed. Use the wallet you just connected.',TOO_MANY_REQUESTS:'Too many requests. Please try again later.',ORIGIN_DENIED:'Login is not enabled for this game address. Use the official game entry.',cancelled:'Login cancelled. You can connect again.',pending:'A wallet request is pending. Open OKX to finish it.',unavailable:'No injected wallet found. Use the OKX app on mobile or enable its desktop extension.',network:'Network unavailable. Please retry.',timeout:'Login timed out. Check your wallet before trying again.',mobileHint:'Connection and sign-in require two wallet confirmations. The game continues automatically; tap the “Open OKX” button below to continue the current step if needed.',ready:'Prepare · Try the controls',walletLabel:'Wallet login',ios1:'Open this game in Safari and tap Share.',ios2:'Choose “Add to Home Screen” and confirm.',ios3:'Open EMBER from your Home Screen, unlock rotation and turn your phone.',android1:'Open this game in Chrome and tap ⋮.',android2:'Choose “Add to Home screen” or “Install app” and confirm.',android3:'Open EMBER from your Home Screen and enable auto-rotate.',returnGame:'Return to game',guideButton:'Landscape / Web app guide',guest:'Later',walletClose:'Close wallet',waiting:'Waiting · Try the controls',trial:'Try the controls',back:'Back to setup'}
};
export const text=key=>TEXT[language()][key]||key;

export function controlSequence(value,touch=false,lang=language()){
 if(!touch)return value;
 const names=lang==='en'?{W:'Stick ↑',S:'Stick ↓',A:'Stick ←',D:'Stick →',J:'Attack',H:'Heavy',K:'Jump',L:'Dodge',U:'Ranged',O:'Minor',E:'Special',I:'Super',F:'Crouch guard',R:'Reset',Esc:'Menu'}:{W:'摇杆↑',S:'摇杆↓',A:'摇杆←',D:'摇杆→',J:'普攻',H:'重击',K:'跳跃',L:'闪避',U:'远程',O:'小技',E:'特殊技',I:'必杀',F:'蹲防',R:'重置位置',Esc:'菜单'};
 return String(value).replace(/A\s*[\/／]\s*D/g,lang==='en'?'Stick ←/→':'摇杆←/→').replace(/按 R/g,lang==='en'?'Tap Reset':'点「重置位置」').replace(/\b(Esc|[WASDJHKLUOEIFR])\b/g,k=>names[k]);
}
export const entryCopy={
 networkPing:['延迟 {ms} ms','Ping {ms} ms'],
 networkPending:['延迟 -- ms','Ping -- ms'],
 networkReconnecting:['重连中','Reconnecting'],
 networkWaiting:['等待响应','Waiting'],
 networkRttHint:['本机到对战服务器的往返耗时，包含服务器处理时间；不是对手的延迟。','Round-trip time to the game server, including server processing; not the opponent’s latency.'],
"campaignChapters":["试炼章节", "Trial chapters"],
"campaignBaseLocked":["通过基础训练后解锁", "Clear the basic trials first"],
"campaignWin":["试炼通过", "Trial cleared"],
"campaignLose":["继续挑战", "Keep trying"],
"campaignDraw":["势均力敌", "Draw"],
"campaignBase":["基础 01–06", "Basics 01–06"],
"campaignAdvanced":["进阶 07–12", "Advanced 07–12"],
"campaignLocked":["通过上一关后解锁", "Clear the previous stage to unlock"],
"campaignStatus":["第 {n} 关 · {name}", "Stage {n} · {name}"],
"campaignNext":["挑战下一关", "Next stage"],
"campaignBack":["返回擂台", "Back to arena"],
"campaignPass":["试炼通过，下一关已解锁。", "Trial cleared. The next stage is unlocked."],
"campaignBasePass":["基础训练全部完成，进阶试炼已解锁。", "All basic training cleared. Advanced trials unlocked."],
"campaignComplete":["十二关试炼全部完成！可以重选任意关卡挑战。", "All twelve trials cleared! Replay any stage."],
"campaignRetry":["观察对手的出招，调整距离再挑战。", "Watch your opponent and adjust your spacing before trying again."],
"campaignAi":["AI 实战试炼", "AI combat trial"],
"stageName1":["初入擂台", "First bout"],"stageHint1":["熟悉移动与攻击，赢下第一场切磋。", "Learn movement and attacks to win your first bout."],
"stageName2":["守住阵线", "Hold the line"],"stageHint2":["观察出招，格挡后再反击。", "Watch attacks, block and counter."],
"stageName3":["突破防守", "Break the guard"],"stageHint3":["抓住对手收招空隙，突破防守。", "Catch recovery openings to break through."],
"stageName4":["控制距离", "Control space"],"stageHint4":["用跳跃与突进接近保持距离的对手。", "Jump and dash to close on a spacing opponent."],
"stageName5":["连击试炼", "Combo trial"],"stageHint5":["升龙命中后跳跃，接普攻与空中特殊技。", "Land a launcher, jump, then follow with light attacks and an air special."],
"stageName6":["守夜人考核", "Nightwatch exam"],"stageHint6":["综合运用全部招式，完成基础训练。", "Combine your techniques to complete basic training."],
"stageName7":["巡夜交锋", "Night patrol"],"stageHint7":["对手开始连续追击，稳住防守后抓住间隙反击。", "Face sustained pressure. Defend, then counter between attacks."],
"stageName8":["长街追猎", "Street pursuit"],"stageHint8":["对手更善于控距与远程牵制，别急着追打。", "Close in carefully against spacing and ranged pressure."],
"stageName9":["凌空破阵", "Aerial assault"],"stageHint9":["留意对空升龙，交替使用地面与空中进攻。", "Watch for anti-air launchers. Mix ground and aerial offense."],
"stageName10":["攻守逆转", "Counter turn"],"stageHint10":["对手会利用收招空隙反击，减少落空与冒进。", "Your opponent punishes recovery. Avoid whiffs and reckless attacks."],
"stageName11":["连段风暴", "Combo storm"],"stageHint11":["提防命中后的连续追击，管理能量与闪避时机。", "Beware hit-confirmed combos. Manage energy and dodge timing."],
"stageName12":["破晓终试", "Dawn final"],"stageHint12":["综合控距、防反与连段，迎战最终守关者。", "Master spacing, counters and combos against the final challenger."],

"depositWallet":["押金房间需要钱包。连接并登录后继续，也可以不连接，返回免费对战。", "Deposit rooms need a wallet. Sign in to continue, or return to free play without connecting."],
"returnFree":["返回免费模式", "Return to free play"],

"confirmFighter":["选好了，立即开始", "Confirm & start"],
"selectFighter":["选择出战角色", "Choose your fighter"],
"backSetup":["← 返回准备", "← Back to setup"],
"selectDummy":["训练假人", "Training dummy"],
"selectOpponent":["人机角色", "AI opponent"],
"walletDismiss":["返回游戏", "Back to game"],
"walletDesktopGuide":["连接钱包后确认登录签名，完成后自动返回游戏。登录不会支付或授权代币。", "Connect your wallet and confirm the sign-in message. You will return to the game automatically. Sign-in does not transfer or approve tokens."],
"coachTitle":["连招练习", "Combo practice"],
"coachLast":["最近命中", "Last hit"],
"coachCombo":["本次连段", "Combo"],
"coachBest":["最佳纪录", "Best"],
"coachGuard":["削血", "Chip"],
"coachNext":["换连招", "Next combo"],
"coachReset":["重置", "Reset"],
"coachSettings":["训练设置", "Lab settings"],
"coach_ready":["按提示出招，命中后接下一招。", "Follow the sequence; confirm a hit before continuing."],
"coach_progress":["衔接成功，继续下一步。", "Confirmed! Continue to the next step."],
"coach_success":["松开按键后自动归位，再练一次。", "Release controls to reset and try again."],
"coach_failed":["松开按键后自动归位。", "Release controls to reset."],
"coach_hint":["每段命中后再衔接；菜单可查完整连招。", "Confirm each hit; open the menu for all combo routes."],
"route_ground-three":["三段起手", "Three-hit opener"],
"route_ground-burst":["地面爆发", "Ground burst"],
"route_launcher-air":["升龙追击", "Launcher pursuit"],
"route_dash-turn":["穿身反打", "Dodge & turn"],
"route_air-three":["空中三连", "Air triple"],
"route_air-shot":["浮空射击", "Air projectile"],
"route_air-heavy":["空中重击终结", "Air heavy finish"],
"route_air-burst":["空中爆发", "Air burst"],
"route_air-dash":["空中突袭", "Air ambush"],
"route_air-super":["空中必杀", "Air super"],
"route_ember-air-small":["焰翼连踢", "Flame wing kicks"],
"route_frost-air-small":["月轮追击", "Moon pursuit"],
"route_ember-finish":["赤莲终结", "Crimson lotus finish"],
"route_frost-finish":["霜月终结", "Frost moon finish"],

 homeSolo:['电路板挑战','Circuit challenge'],homeSoloText:['选择角色，挑战十二关试炼','Choose a fighter and take on twelve trials'],homeSoloGo:['开始挑战 ↗','Start challenge ↗'],
 homePvp:['在线对战','Online duel'],homePvpText:['连接 X Layer 钱包，与好友对战','Sign in on X Layer and duel a friend'],homePvpGo:['进入大厅 ↗','Enter lobby ↗'],
 homeLab:['连段训练','Combo training'],homeLabText:['无限生命，练习每一次衔接','Unlimited health to practise every follow-up'],homeLabGo:['开始训练 ↗','Start training ↗'],
 settings:['设置','Settings'],help:['操作指南','Controls'],quit:['退出游戏','Quit'],
 comboNoteTouch:['→ 依次点按，＋同时操作。摇杆↑＋普攻为升龙；用摇杆←/→调整朝向。攻击命中后再接下一招。','→ Tap in order; ＋ use together. Stick ↑ + Attack launches. Turn with Stick ←/→. Confirm a hit before the next attack.'],
 comboNoteKeys:['→ 依次点按，＋同时按下。W＋J为升龙；用 A / D 调整朝向。攻击命中后再接下一招。','→ Press in order; ＋ press together. W + J launches; A / D turns. Confirm a hit before the next attack.'],
 airKeys:['J 三连 · H 重击 · U 远程 · O 小技 · E 特殊技 · I 必杀','J combo · H heavy · U ranged · O minor · E special · I super'],
 helpMoveTouch:['拖动左摇杆左右移动，下拉蹲防；上推摇杆并点普攻，打出升龙。倒计时结束时，保持摇杆方向即可接着移动。','Move with the left stick; pull down to crouch and guard. Push up + tap Attack to launch. Keep the stick held through the countdown to move seamlessly at FIGHT.'],
 helpMoveKeys:['A / D 移动，S 蹲伏，F 防御，W＋J 升龙。准备倒计时结束后，方向键继续生效。','A / D moves; S crouches, F guards, W + J launches. Held movement continues when the countdown ends.'],
 helpAttackTouch:['左侧仅摇杆；右侧是普攻、重击、跳跃、闪避及全部技能。连续点按普攻可接三段。','The left side has only the stick. Attack, Heavy, Jump, Dodge and all skills are on the right. Tap Attack for a three-hit combo.'],
 helpAttackKeys:['J 普攻，H 重击，K 跳跃，L 闪避，U 远程，O 小技，E 特殊技，I 必杀。连续点按 J 可接三段。','J Attack; H Heavy; K Jump; L Dodge; U Ranged; O Minor; E Special; I Super. Tap J for a three-hit combo.'],
 helpComboTouch:['升龙追击：摇杆↑＋普攻 → 跳跃 → 普攻 → 普攻 → 重击。空中爆发：跳跃 → 普攻 → 普攻 → 特殊技 → 必杀。每段攻击命中后再接下一步。','Launcher: Stick ↑ + Attack → Jump → Attack → Attack → Heavy. Air burst: Jump → Attack → Attack → Special → Super. Confirm each hit before following up.'],
 helpComboKeys:['升龙追击：W＋J → K → J → J → H。空中爆发：K → J → J → E → I。每段攻击命中后再接下一步。','Launcher: W + J → K → J → J → H. Air burst: K → J → J → E → I. Confirm each hit before following up.'],
 helpCombat:['200 生命；必杀消耗70能量。闪避可穿过对手，穿身后需要手动回身。','200 health; Super costs 70 energy. Dodge can pass through an opponent; turn manually afterward.'],
 helpMenu:['菜单内查看完整连招与训练说明。单人对战打开菜单会暂停；联机对局仍继续。','Open the menu for full combo routes and training. Menus pause solo battles; online battles continue.'],
 combos:['查看完整连招','Full combo routes'],reset:['重置位置','Reset position'],helpTitle:['操作指南','Controls']
};
export const entryText=key=>entryCopy[key]?.[language()==='en'?1:0]||key;

export const guideCopy={
 tutorial:['添加到主屏幕教程','Add to Home Screen'],device:['选择手机类型','Choose your device'],
 browser:['当前游戏网页','This game page'],share:['分享','Share'],more:['更多','More'],
 add:['添加到主屏幕','Add to Home Screen'],webApp:['作为网页 App 打开','Open as Web App'],confirm:['添加','Add'],install:['安装应用','Install app'],
 iphone1Title:['在 Safari 中打开游戏','Open the game in Safari'],
 iphone1:['如果当前在钱包或聊天内置浏览器，先打开右上角菜单，选择“在浏览器打开”，然后用 Safari 继续。已经在 Safari 时，直接看下一步。','If you are in a wallet or chat browser, open its menu and choose Open in Browser, then continue in Safari. Already in Safari? Go to the next step.'],
 iphone1Tip:['浏览器全屏与主屏幕网页 App 是两种打开方式。','Browser fullscreen and a Home Screen web app are different launch modes.'],
 iphone2Title:['分享 → 添加到主屏幕','Share → Add to Home Screen'],
 iphone2:['点 Safari 的分享按钮（方框内向上箭头），向下找到“添加到主屏幕”。如果出现“作为网页 App 打开”，保持开启，然后点“添加”。','Tap Share (square with an up arrow), scroll to Add to Home Screen, enable Open as Web App if shown, then tap Add.'],
 iphone2Tip:['找不到“添加到主屏幕”时，向下查看“编辑操作”。','If Add to Home Screen is missing, look for Edit Actions below.'],
 iphone3Title:['从主屏幕图标重新进入','Launch the Home Screen icon'],
 iphone3:['返回手机主屏幕，点击“余烬”图标。进入后会自动识别网页 App；需要旋转时，在控制中心关闭竖排方向锁定，再调整手机方向。','Return to your Home Screen and tap EMBER. The game detects web app mode. To rotate, turn off Portrait Orientation Lock in Control Center and turn your phone.'],
 iphone3Tip:['钱包确认后，切回这个余烬网页 App；不要重新打开另一个游戏标签页。','After a wallet confirmation, return to this EMBER web app instead of a new game tab.'],
 android1Title:['在 Chrome 中打开游戏','Open the game in Chrome'],
 android1:['从钱包或聊天页面的菜单选择“在浏览器打开”，使用 Chrome 继续。不同手机菜单位置可能不同。','Choose Open in Browser from your wallet or chat menu and continue in Chrome. Menu placement varies by device.'],
 android1Tip:['后续操作使用当前游戏地址，无需复制固定域名。','Use the current game address; no fixed domain needs to be copied.'],
 android2Title:['菜单 → 添加到主屏幕 → 安装','Menu → Add to Home screen → Install'],
 android2:['打开 Chrome 右上角 ⋮，选择“添加到主屏幕”，再选择“安装”；部分版本直接显示“安装应用”。按浏览器提示确认。','Open Chrome’s ⋮ menu, choose Add to Home screen, then Install. Some versions show Install app directly. Confirm the browser prompt.'],
 android2Tip:['若只生成普通快捷方式、打开后仍有地址栏，请重新选择“安装”选项；系统浏览器的名称可能不同。','If you only get a shortcut with an address bar, use the Install option instead. Other browsers may use different labels.'],
 android3Title:['点击桌面的余烬图标','Tap EMBER on your Home screen'],
 android3:['从桌面图标启动余烬。需要旋转时，在快捷设置中开启“自动旋转”，再调整手机方向。','Launch EMBER from its Home screen icon. To rotate, enable Auto-rotate in Quick Settings and turn your phone.'],
 android3Tip:['钱包连接和登录签名可能需要两次确认；每次都回到原来的游戏窗口。','Connection and sign-in may require two confirmations. Return to the original game window each time.'],
 previous:['上一步','Back'],next:['下一步','Next'],official:['官方操作说明 ↗','Official instructions ↗'],
 connectStep:['1 · 连接 OKX 钱包','1 · Connect OKX'],signStep:['2 · 签名登录 X Layer','2 · Sign in on X Layer'],
 connectDetail:['确认连接后，游戏会接着请求登录签名。若先打开 OKX 网页，点“前往 App”。','After connection, the game continues with sign-in. If the OKX website opens first, tap Open App.'],
 signDetail:['登录签名不转账、不授权代币。确认后返回原游戏；未弹出时点“继续打开 OKX”，不必重连。','Sign-in does not transfer funds or approve tokens. Return to this game afterward. If needed, tap Continue in OKX without reconnecting.'],
 returnHome:['返回首页','Back to home'],walletRequired:['联机前请完成钱包连接与登录签名。单人模式无需钱包。','Connect and sign in before an online duel. Solo modes need no wallet.']
};
export const guideText=key=>guideCopy[key]?.[language()==='en'?1:0]||key;

// Shared entrance vocabulary: used by setup, room lists and the compact dialogs.
Object.assign(entryCopy,{
 soloTab:['电路板挑战','Circuit challenge'],pvpTab:['联机对战','Online duel'],training:['连段训练','Training'],challengeAI:['挑战 AI','Challenge AI'],author:['作者 X ↗','Creator X ↗'],
 soloTitle:['电路板挑战','Circuit challenge'],pvpTitle:['与朋友，一决高下','Ready for a duel'],labTitle:['练习每一次衔接','Master the next hit'],
 pvpIntro:['建立房间邀请朋友，或从大厅选择房间加入。','Create a room for a friend, or choose one from the lobby.'],
 soloHint:['选择关卡，再选择你的出战角色。','Choose a stage, then choose your fighter.'],labHint:['调整假人，练习完整连招。','Set up the dummy and practise your combos.'],
 roomOptions:['房间设置 · 可选','Room options'],optionalPassword:['房间密码 · 选填','Room password · optional'],
 fundingRoom:['准备中','Preparing'],yourRoom:['我的房间','Your room'],playerRoom:['{n}的房间',"{n}’s room"],create:['建立房间','Create room'],joinCode:['房间码加入','Join by code'],roomCode:['房间码','Room code'],join:['加入房间','Join room'],cancel:['取消','Cancel'],
 rooms:['房间大厅','Room lobby'],refresh:['刷新房间','Refresh'],emptyRooms:['暂无房间，建立一个让朋友加入。','No rooms yet. Create one for your friend.'],roomCount:['{n} 个房间','{n} rooms'],waitingRoom:['等待加入','Waiting'],playingRoom:['对战中','Playing'],lockedRoom:['密码房间','Private room'],passwordJoin:['输入密码','Enter password'],roomsOffline:['暂时无法连接大厅，请刷新重试。','Lobby unavailable. Refresh to retry.'],
 waitingTitle:['等待朋友进入房间','Waiting for a friend'],copy:['复制','Copy'],publicRoom:['朋友可从大厅选择你的房间加入。','Your friend can join your room from the lobby.'],privateRoom:['朋友从大厅选择房间后输入密码。','Your friend selects the room in the lobby and enters its password.'],leaveRoom:['离开房间','Leave room'],waitingPrimary:['等待对手加入…','Waiting for an opponent…'],
 startSolo:['开始挑战','Start challenge'],startLab:['开始训练','Start training'],selectStage:['选择关卡','Choose a stage'],trainingSettings:['训练设置','Training settings'],
 ready:['准备就绪','Ready'],pocketHint:['上＋普攻 升龙 · 下拉 蹲防','↑ + Attack: launch · ↓: guard'],
 helpAttackTouch:['普攻与重击各有独立区域，竖屏下分开排列。连续点按普攻可接三段；跳跃、闪避、远程、小技、特殊技、必杀均有独立按钮。','Attack and Heavy have separate hit areas, spaced apart in portrait. Tap Attack for a three-hit combo; Jump, Dodge, Ranged, Minor, Special and Super have individual buttons.'],
 passwordLength:['密码需为 4–32 个字符。','Use a password with 4–32 characters.'],joinFailed:['加入失败，请检查密码或房间状态后重试。','Could not join. Check the password or room status and retry.'],invalidCode:['请输入有效的 6 位房间码。','Enter a valid 6-character room code.'],
 roomCreated:['房间已建立，等待朋友加入。','Room created. Waiting for your friend.'],roomConnected:['房间已连接','Room connected'],connectingRoom:['正在进入房间…','Entering the room…'],cancelConnect:['取消连接','Cancel connection']
});
TEXT.zh.rotateText='横屏视野更宽；竖屏已适配掌机布局，也可以继续竖屏游玩。需要横屏时，请关闭手机方向锁再旋转。';
TEXT.en.rotateText='Landscape gives you a wider view. Portrait has its own pocket-console controls, so you can keep playing upright. Unlock rotation to try landscape.';
Object.assign(guideCopy,{
 rotationHelp:['旋转帮助','Rotation help'],rotateReady:['已了解，继续','Got it, continue'],
 rotateHelpTitle:['调整手机方向','Rotate your phone'],rotateHelp:['iPhone：在控制中心关闭竖排方向锁。Android：在快捷设置开启自动旋转。如果仍无法旋转，可以直接使用竖屏掌机布局。','iPhone: turn off Portrait Orientation Lock in Control Center. Android: enable Auto-rotate in Quick Settings. If rotation is unavailable, continue with the portrait pocket layout.']
});

Object.assign(entryCopy,{
 demoLauncher:['升龙','Launcher'],demoTitle:['实战连招演示','COMBO SHOWCASE'],demoJin:['烬 · 赤焰拳术','JIN · Flame fists'],demoShuang:['霜 · 银月剑术','SHUANG · Moon blade'],
 demoNext:['换一招','Next combo'],demoPause:['暂停','Pause'],demoPlay:['播放','Play'],demoTouch:['触屏操作','TOUCH CONTROLS'],demoKeys:['键盘操作','KEYBOARD CONTROLS'],
 demoHint:['按顺序衔接，命中后接下一招。','Follow the sequence. Confirm each hit, then chain the next move.'],demoReady:['准备起手','Get ready'],demoComplete:['连招完成','Combo complete'],demoHits:['{n} 连击','{n} HITS'],demoPaused:['演示已暂停','Demo paused']
});

Object.assign(entryCopy,{
 demoMusicStart:['开启音乐','Enable music'],demoMusicOn:['音乐 ON','Music ON'],demoMusicOff:['音乐 OFF','Music OFF'],
 audioOff:['全部声音已关闭','All sound is off'],audioRetry:['请点击试听启用声音。','Tap a preview to enable sound.'],audioOn:['声音已启用 · 演示与战斗时播放音乐','Sound enabled · Music plays in demos and battles'],audioStart:['点击页面或试听后启用声音','Tap the page or a preview to enable sound'],soundOn:['声音 ON','Sound ON'],soundOff:['声音 OFF','Sound OFF'],soundDisable:['关闭全部声音','Mute all sound'],soundEnable:['开启全部声音','Enable sound'],
 walletSending:['正在发送请求，请稍候…','Sending the request…'],walletOpenSign:['打开 OKX，确认登录','Open OKX to sign in'],walletOpenConnect:['打开 OKX，确认连接','Open OKX to connect'],
 bootFailed:['资源未能载入，请重新载入。','Resources could not load. Please reload.']
});

Object.assign(entryCopy,{
 fighterJin:['烬','JIN'],fighterShuang:['霜','SHUANG'],fighterJinStyle:['赤焰拳术','Flame fists'],fighterShuangStyle:['银月剑术','Moon blade'],stageNumber:['第 {n} 关','Stage {n}'],
 coachNextMove:['下一招 · {move}','Next · {move}'],coachExecuting:['{move} · 出招中','{move} · In motion'],coachWaitHit:['等待命中，成功后接下一招。','Wait for the hit, then follow up.'],
 coach_successTitle:['连招完成！','Combo complete!'],coach_failedTitle:['未接上 · 再试一次','Try the combo again'],
 coachBreak:['对手已恢复行动，接招要更快。','The opponent recovered; follow up sooner.'],coachOrder:['招式不符，按提示顺序出招。','Wrong move; follow the sequence.'],coachTimeout:['间隔太长，请连续衔接。','Too much delay between moves.'],
 coachDistance:['未命中，靠近对手。','Out of range; move closer.'],coachFacing:['未命中，转向对手。','Turn to face the opponent.'],coachHeight:['高度不符，调整跳跃时机。','Adjust your jump timing.'],coachBlocked:['被格挡，不计为命中。','Blocked hits do not advance the combo.'],
 coachEnergy:['能量不足，检查训练设置。','Not enough energy; check lab settings.'],coachCooldown:['技能冷却中，请稍候。','Move is on cooldown.'],coachTiming:['输入过早或无法衔接，请在命中后接招。','Too early or no cancel window; follow up on hit.'],coachMiss:['没有命中，检查距离与朝向。','No hit; check range and facing.']
});

Object.assign(entryCopy,{
 aiStatus:['AI 状态','AI STATUS'],aiStage:['关卡 {n}','STAGE {n}'],aiDistance:['距离','DIST'],aiEnergy:['能量','ENERGY'],aiPosition:['位置','POSE'],aiAir:['空中','AIR'],aiGround:['地面','GROUND'],aiAction:['动作','ACT'],
 aiStatusHint:['闯关 AI 的实时状态与实际动作；电路风格示意，不是 NAND 网表。','Live campaign AI state and actual actions. Circuit-style display, not a NAND netlist.'],
 ai_idle:['待机','Idle'],ai_hurt:['受击','Hit stun'],ai_light:['普攻 · 1','Attack · 1'],ai_light2:['普攻 · 2','Attack · 2'],ai_light3:['普攻 · 3','Attack · 3'],ai_airLight:['空中普攻','Air attack'],ai_heavy:['重击','Heavy'],ai_low:['低段攻击','Low attack'],ai_skill:['特殊技','Special'],ai_ranged:['远程','Ranged'],ai_launch:['升龙上挑','Launcher'],ai_dash:['闪避','Dodge'],ai_small:['小技','Minor'],ai_super:['必杀','Super'],ai_guard:['格挡','Guard'],ai_jump:['跳跃','Jump'],ai_move:['移动','Move'],ai_ready:['准备','Ready'],ai_rest:['回合间歇','Round break']
});

Object.assign(entryCopy,{
 circuitBoard:['电路板','Circuit'],circuitWaiting:['等待决策','Waiting'],circuit_move:['移动','Movement'],circuit_guard:['防守','Defence'],circuit_combo:['连招','Combo'],circuit_attack:['攻击','Attack'],circuit_output:['输出','Output'],
 circuitHint:['本地规则电路的真实 NAND 信号；IN / OUT 以十六进制显示。','Actual NAND signals from the local rule circuits; IN / OUT are hexadecimal.'],
 campaignAILabel:['挑战 AI','Challenge AI'],campaignCircuit:['电路 AI','Circuit AI'],campaignLegacy:['原版 AI','Original AI'],campaignAINote:['下一局生效，可随时切回原版。','Applies next match. You can switch back to the original AI.'],campaignAISaved:['已保存，下一局生效。','Saved. Applies next match.']
});
