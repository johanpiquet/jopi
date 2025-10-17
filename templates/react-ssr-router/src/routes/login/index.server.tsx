import {type LoginPassword, RouteServerContext} from "jopi-rewrite";

export default function(ctx: RouteServerContext) {
    ctx.onPOST(async req => {
        const data = await req.getBodyData();
        console.log("Post data:", data);

        let authResult = await req.tryAuthWithJWT(data as LoginPassword);

        return req.jsonResponse({
            isOk: authResult.isOk,
            authResult: authResult
        });
    });
}