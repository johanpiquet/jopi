import {jopiApp} from "jopi-rewrite";

jopiApp.startApp(jopiEasy => {
    // Create the website.
    jopiEasy.new_webSite("http://127.0.0.1:3000")
        // >>> Uncomment to use dev local certificate.
        //
        //.add_httpCertificate()
        //    .generate_localDevCert()
        //    .DONE_add_httpCertificate()

        // Catch calls to http://127.0.0.1:3000 and http://127.0.0.1:3000/
        //
        .add_path("/")
            // >>> Sample GET handler

            .onGET(async req => {
                return req.htmlResponse("Return some HTML")
            })


            // Like add_path("/")
            .add_samePath()

            // >>> Sample POST handler

            .onPOST(async req => {
                const data = req.getReqData(true);

                const myResponse = {
                    in: data,
                    out: "my response"
                };

                return req.jsonResponse(myResponse);
            })

        // Catch everything else and return a 404 error.
        .add_path("/**").onGET(async req => req.returnError404_NotFound())
});