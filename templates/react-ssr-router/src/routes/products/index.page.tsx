import {isServerSide} from "jopi-rewrite/ui";
import {Link} from "react-router";

export default function() {
    if (isServerSide) {
        console.log("Products: server side render");
    }

    return <div>
        <div>Listing page</div>
        <div><Link to="productA/details">Product A</Link></div>
        <div><Link to="productB/details">Product B</Link></div>
    </div>;
}