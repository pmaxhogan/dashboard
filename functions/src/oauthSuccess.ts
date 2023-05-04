/**
 * Handler for oauth success
 * @param {any} req The request
 * @param {any} res The response
 */
export default function oauthSuccess(req: any, res: any) {
    res.send("oauth success").end();
}
