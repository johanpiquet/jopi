import React from "react";
import {mustHydrate} from "jopi-rewrite/ui";

export default mustHydrate(import.meta, function() {
    // A very basic template.
    return <div>Page 404 - Not Found</div>
});