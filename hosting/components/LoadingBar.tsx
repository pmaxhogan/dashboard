export default function LoadingBar({className}: {className?: string}){
    return (
        <div className={"lds-grid " + (className ?? "")}>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
        </div>
    );
}