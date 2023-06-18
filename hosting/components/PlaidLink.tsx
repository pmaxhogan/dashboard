
import {
    usePlaidLink,
    PlaidLinkOptions,
    PlaidLinkOnSuccess, PlaidLinkOnSuccessMetadata,
} from "react-plaid-link";
import {useCallback, useState} from "react";
import useSWR from "swr";
import {fetcher} from "../lib/fetcher";


export default function PlaidLink({className}: {className?: string}){
    const {data: linkTokenData, error: plaidTokenError} = useSWR("/login/plaid", fetcher);


    const onSuccess = useCallback<PlaidLinkOnSuccess>(
        (public_token: string, metadata: PlaidLinkOnSuccessMetadata) => {
            console.log("onSuccess", public_token, metadata);

            // noinspection JSIgnoredPromiseFromCall
            fetcher(`/callback/plaid?public_token=${public_token}`);
        },
        [],
    );

    // The usePlaidLink hook manages Plaid Link creation
    // It does not return a destroy function;
    // instead, on unmount it automatically destroys the Link instance
    const config: PlaidLinkOptions = {
        onSuccess,
        onExit: (err, metadata) => {},
        onEvent: (eventName, metadata) => {},
        token: linkTokenData?.linkToken ?? "",
    };

    const { open, exit, ready } = usePlaidLink(config);


    if(plaidTokenError) {
        console.error("plaidTokenError", plaidTokenError);
        return <div>failed to load</div>;
    }

    return (
        <div onClick={() => open()}>
           Link
        </div>
    );
}