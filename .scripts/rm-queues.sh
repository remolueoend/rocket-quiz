#!/usr/bin/env bash

for word in "$@"
do
        args=true
        newQueues=$(rabbitmqctl list_queues name | grep "$word")
        queues="$queues
$newQueues"
done
if [ $# -eq 0 ]; then
        queues=$(rabbitmqctl list_queues name | grep -v "\.\.\.")
fi

queues=$(echo "$queues" | sed '/^[[:space:]]*$/d')

if [ "x$queues" == "x" ]; then
        echo "No queues to delete, giving up."
        exit 0
fi

read -p "Deleting the following queues:
${queues}
[CTRL+C quit | ENTER proceed]
"

while read -r line; do
        rabbitmqadmin delete queue name="$line"
done <<< "$queues"