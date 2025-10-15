import React from "react";
import {mustHydrate} from "jopi-rewrite/uikit";

// Here it's a CSS module.
// For practicality, we use SAAS (SCSS) instead.
//
import styles from "./PageHome.module.scss";

const myPage = () => {
    // Also to see that our component is alive and responding to events.
    const onClick = () => { alert("Clicked!") };

    return <div className={styles.myPage}>
        <div>The home page</div>
        <div className={styles.myButton} onClick={onClick}>Click me</div>

        <a className={styles.myButton} href="/login">Go to login page</a>
    </div>
};

// mustHydrate allows our component to be interactif in the browser.
// Without that, we only have a React component with a visual and
// no interaction (as produced by the server and seen by Google).
//
export default mustHydrate(
    import.meta,        // <- Allow finding this file path
    myPage,             // <- Our component
    styles              // <- Optional: allow embedding the styles in the page header (inlined)
);