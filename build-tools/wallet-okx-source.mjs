// Build-only entry, pinned to the same OKX Connect 1.9.1 as Black Myth.
import {OKXUniversalProvider,OpenAppLinkType} from '@okxconnect/universal-provider/src/index.js';
import {getOKXLink} from '@okxconnect/core/src/utils/url.js';
import {adaptMobileWallet} from './wallet-okx-adapter.mjs';
export async function createMobileWallet(options={}){
 const sdk=await OKXUniversalProvider.init({openAppLinkType:OpenAppLinkType.DeepLink,dappMetaData:{name:'TapeOutScan · EMBER',icon:new URL('./assets/app-192.png',location.href).href}});
 return adaptMobileWallet(sdk,{...options,getLink:getOKXLink});
}
