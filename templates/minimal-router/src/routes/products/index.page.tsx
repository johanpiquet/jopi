import React from "react";
import {usePageTitle} from "jopi-rewrite/uikit";

// This file is what is served when consulting page http://127.0.0.1:3000/products

export default function () {
    usePageTitle("Products");

    return <div className="flex flex-col items-center m-20">
        <div className="text-gray-500">The product page</div>
        <div className="text-red-300">TODO: add plenty of great products!</div>
    </div>
}