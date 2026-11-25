/**
 * 拒绝从不是合法写目标的路径形态：UNC 共享、设备命名空间、备用数据流（ADS）、
 * 盘符相对路径与 Windows 保留设备名。CLI 的 --out 与 setup 安装器共用；网络/设备
 * 路径可能触发出站认证或设备访问（如 CON/COM1），在触碰文件系统之前按形态拒绝。
 *
 * @param candidate 用户输入的原始路径（不解析、不规范化）
 * @param errorCode 稳定错误码；setup 用 SETUP_PATH_INVALID，CLI 输出用 OUT_PATH_INVALID
 */
import {basename} from "node:path";
const windows=process.platform==="win32";
export function assertSafePathForm(candidate:string,errorCode="SETUP_PATH_INVALID"):void{
 if(candidate.includes("\0"))throw new Error(errorCode);
 if(/^[\\/]{2}/.test(candidate))throw new Error(errorCode);
 if(!windows)return;
 if(/^[A-Za-z]:(?![\\/])/.test(candidate))throw new Error(errorCode);
 const absolute=/^[A-Za-z]:[\\/]/.test(candidate);
 for(let index=candidate.indexOf(":");index!==-1;index=candidate.indexOf(":",index+1))
  if(!(absolute&&index===1))throw new Error(errorCode);
 // 保留设备名只按完整末段名匹配（无扩展名）："CON" 拒绝，"con.md" 是普通文件名不受影响。
 if(/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(basename(candidate)))throw new Error(errorCode);
}
