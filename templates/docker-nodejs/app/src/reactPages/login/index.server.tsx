import {getRouteContext} from "jopi-rewrite";
import {type LoginPassword} from "jopi-rewrite";

let ctx = getRouteContext();

ctx.onPOST(async req => {
    const data = await req.getReqData(true);
    console.log("Post data:", data);

    let authResult = await req.tryAuthWithJWT(data as LoginPassword);

    return req.jsonResponse({
        isOk: authResult.isOk,
        authResult: authResult
    });
});