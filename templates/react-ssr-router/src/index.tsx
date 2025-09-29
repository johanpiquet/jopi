import {jopiApp} from "jopi-rewrite";
import myUsers from "./myUsers.json" with { type: "json" };

jopiApp.startApp(import.meta, jopiEasy => {
    // Create the website.
    // Here we add the capacity to server files.
    //
    jopiEasy.new_fileServer("http://127.0.0.1:3000")
        // ./www is the default directory, so we can skip this line.
        .set_rootDir("www")
        .DONE_new_fileServer()

        // Enable the page router mechanism.
        // Scan the directory 'routes' to discover routes.
        // --> Server Side: use the directory path to build routes.
        // --> Browser Side: enable and configure React Router.
        //
        .enable_automaticRoutes()

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