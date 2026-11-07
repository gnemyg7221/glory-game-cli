import { BYTEDANCE, DEBUG, HONOR, HTML5, HUAWEI, NATIVE, OPPO, VIVO, WECHAT, XIAOMI } from "cc/env";

export class EnvUtils {
    static OPPO = () => {
        if (OPPO) {
            return true;
        }else{
            return false;
        }
    }

    static VIVO = () => {
        if (VIVO) {
            return true;
        }else{
            return false;
        }
    }

    static BYTEDANCE = () => {
        if (BYTEDANCE) {
            return true;
        }else{
            return false;
        }
    }

    static HUAWEI = () => {
        if (HUAWEI) {
            return true;
        }else{
            return false;
        }
    }
    
    static WECHAT = () => {
        if (WECHAT) {
            return true;
        }else{
            return false;
        }
    }

    static H5 = () => {
        if (HTML5) {
            return true;
        }else{
            return false;
        }
    }

    static ANDROID = () => {
        if (NATIVE) {
            return true;
        }else{
            return false;
        }
    }

    static RONGYAO = () => {
        if (HONOR) {
            return true;
        }else{
            return false;
        }
    }

    static XIAOMI = () => {
        if (XIAOMI) {
            return true;
        }else{
            return false;
        }
    }

    static DEV = () => {
        if (DEBUG) {
            return true;
        }else{
            return false;
        }
    }
}