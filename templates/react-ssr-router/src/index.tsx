import {jopiApp} from "jopi-rewrite";
import myUsers from "./myUsers.json?raw";

jopiApp.startApp(jopiEasy => {
    // Create the website.
    jopiEasy.new_webSite("http://127.0.0.1:3000")

        // Enable the page router mechanism.
        // Scan the directory 'reactPages' to discover routes.
        // --> Server Side: use the directory path to build routes.
        // --> Browser Side: enable and configure React Router.
        //
        .enable_reactRouter(import.meta)

        // Add a JWT Token mechanism for user authentification
        // and user info retrieval.
        //
        .add_jwtTokenAuth()
            .step_setPrivateKey("my-private-key")
            .step_setUserStore()
                .use_simpleLoginPassword()
                    .addMany(myUsers)
                    .DONE_use_simpleLoginPassword()
                .DONE_setUserStore()
            .DONE_add_jwtTokenAuth()
});