import {jopiApp} from "jopi-rewrite";

jopiApp.startApp(import.meta, jopiEasy => {
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

        .DONE_add_path()

        // Set the templates for the pages 404 and 500.
        //
        .add_specialPageHandler()
            .on_404_NotFound(async req => req.reactResponse(<div>404 - Page not found</div>))
            .on_500_Error(async req => req.reactResponse(<div>500 - Server Error</div>))
        .END_add_specialPageHandler()
});