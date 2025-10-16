import {isServerSide, usePageParams} from "jopi-rewrite/uikit";

export default function() {
    let params = usePageParams();

    if (isServerSide) {
        console.log("Details: server side render", params.product);
    }

    return <div>
        Details page for {JSON.stringify(params.product)}
    </div>;
}