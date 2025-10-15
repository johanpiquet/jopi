import React from "react";
import {usePageTitle} from "jopi-rewrite/uikit";

// This file is what is served when consulting page http://127.0.0.1:3000

export default function () {
    usePageTitle("Welcome!");

    return <div className="flex flex-col items-center m-20">
        <div className="text-gray-500">The home page</div>
        <div className="text-red-300">Welcome !</div>
    </div>
}