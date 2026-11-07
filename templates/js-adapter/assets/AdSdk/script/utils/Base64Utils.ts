import { Base64 } from "js-base64";

export class Base64Utils {
    //字符串转base64
    static strEncode(str) {
        // 对字符串进行编码
        var encode = encodeURI(str);
        // 对编码的字符串转化base64
        var base64 = Base64.btoa(encode);
        return base64;
    }

    // base64转字符串
    static strDecode(base64) {
        // 对base64转编码
        var decode = Base64.atob(base64);
        // 编码转字符串
        var str = decodeURI(decode);
        return str;
    }

    //字符串转base64
    static strURIComponentEncode(str) {
        // 对字符串进行编码
        var encode = encodeURIComponent(str);
        // 对编码的字符串转化base64
        var base64 = Base64.btoa(encode);
        return base64;
    }

    // base64转字符串
    static strURIComponentDecode(base64) {
        // 对base64转编码
        var decode = Base64.atob(base64);
        // 编码转字符串
        var str = decodeURIComponent(decode);
        return str;
    }
}
