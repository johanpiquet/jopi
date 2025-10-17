import {JopiRequest, type LoginPassword} from "jopi-rewrite";

export default async function(req: JopiRequest) {
    const data = await req.getBodyData();
    console.log("Post data:", data);

    let authResult = await req.tryAuthWithJWT(data as LoginPassword);

    return req.jsonResponse({
        isOk: authResult.isOk,
        authResult: authResult
    });
}