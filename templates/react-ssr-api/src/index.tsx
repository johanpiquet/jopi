import {jopiApp} from "jopi-rewrite";
import HomePage from "./PageHome.tsx";
import Page404 from "./Page404.tsx";
import Page500 from "./Page500.tsx";
import PageLogin from "./PageLogin.tsx";
import PageLogin_handlePost from "./PageLogin_handlePost.ts";

import myUsers from "./myUsers.json" with { type: "json" };

jopiApp.startApp(import.meta, jopiEasy => {
    // Create the website.
    // Here we add the capacity to server files.
    //
    jopiEasy.new_fileServer("http://127.0.0.1:3000")
        // ./www is the default directory, so we can skip this line.
        .set_rootDir("www")
        .DONE_new_fileServer()

    // >>>> Home page / 404 + 500 page

        // >>> Uncomment to use dev local certificate.
        //
        //.add_httpCertificate()
        //    .generate_localDevCert()
        //    .DONE_add_httpCertificate()

        // Set the template for special pages.
        .add_specialPageHandler()
            .on_404_NotFound(async req => req.reactResponse(<Page404 />))
            .on_500_Error(async req => req.reactResponse(<Page500 />))
        .END_add_specialPageHandler()

        // add_path_GET is a shortcut for add_path("/").onGET
        .add_path_GET("/", async req => {
            return req.reactResponse(<HomePage />);
        })

        // The ":productName" part allows getting the value of this url segment.
        // Ex: with "http://127.0.0.1:3000/products/computer/infos
        //     then productName has the value "computer".
        //
        .add_path_GET("/products/:productName/infos", async req => {
            return req.htmlResponse(`Product name: ${req.urlParts.productName}`);
        })

    // >>>> Manage auth / login part

        // Allow handling login.
        .add_path("/login")
            // The login page visual.
            .onGET(async req => req.reactResponse(<PageLogin />))

            // Will handle server auth server call.
            .add_samePath().onPOST(PageLogin_handlePost)
        .DONE_add_path()

        // Add a JWT Token mechanism for user authentification
        // and user info retrieval.
        //
        .add_jwtTokenAuth()
            // WARNING: you must change this key!
            .step_setPrivateKey("my-private-key")
            .step_setUserStore()
                .use_simpleLoginPassword()
                    .addMany(myUsers)
                    .DONE_use_simpleLoginPassword()
                .DONE_setUserStore()
            .DONE_add_jwtTokenAuth()
});