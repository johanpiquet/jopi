import React from "react";

// "Link" work on server side and browser side
// but only when the router is enabled.
//
import {Link} from "react-router";

// Here it's a CSS module.
// For practicality, we use SAAS (SCSS) instead.
//
import styles from "./index.module.scss";

export default function () {
    // Also to see that our component is alive and responding to events.
    const onClick = () => { alert("Clicked!") };

    return <div className={styles.myPage}>
        <div>The home page</div>
        <div className={styles.myButton} onClick={onClick}>Click me</div>

        <Link className={styles.myButton} to="/login">Go to login page</Link>
        <Link className={styles.myButton} to="/products">Go to products page</Link>
    </div>
}