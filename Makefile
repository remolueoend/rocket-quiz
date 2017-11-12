test_vhost := "unit_tests"
test_user := "guest"
rm-queue-script := ./.scripts/rm-queues.sh
test_bin := ./node_modules/.bin/mocha-webpack
test_opts := ./test/mocha-webpack.opts

.PHONY: rabbit.start rabbit.stop rabbit.manage rabbit.rm-queues rabbit.delete-test-vhost rabbit.create-test-vhost test test.watch


rabbit.start:
	rabbitmq-server &>/dev/null &

rabbit.stop:
	rabbitmqctl stop

rabbit.manage:
	open http://localhost:15672

rabbit.rm-queues: $(rm-queue-script)
	sh $(rm-queue-script)

rabbit.delete-test-vhost:
  # the leading '-' will be stripped by make and tells it to ignore any errors returned by the command:
	-rabbitmqctl delete_vhost $(test_vhost)

rabbit.create-test-vhost: rabbit.delete-test-vhost
	rabbitmqctl add_vhost $(test_vhost)
	rabbitmqctl set_permissions -p $(test_vhost) $(test_user) ".*" ".*" ".*"

rabbit.open-log-dir:
	open /usr/local/var/log/rabbitmq/
	
test: rabbit.create-test-vhost
	node $(test_bin) --opts $(test_opts)
	
test.watch: rabbit.create-test-vhost
	node $(test_bin) --opts $(test_opts) --watch
	