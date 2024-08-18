# Replace with your KV namespace ID
$KV_NAMESPACE_ID = "72dc17b0581b4c81a8e2b84d1df9d011"

# List all keys and delete each one
$keys = wrangler kv:key list --namespace-id $KV_NAMESPACE_ID --preview | ConvertFrom-Json

foreach ($key in $keys) {
    $keyName = $key.name
    Write-Output "Deleting key: $keyName"
    wrangler kv:key delete --namespace-id $KV_NAMESPACE_ID $keyName
}