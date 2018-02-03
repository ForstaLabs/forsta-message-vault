default: build

PACKAGES := node_modules/.packages.build
SEMANTIC := semantic/dist/.semantic.build
GRUNT := dist/.grunt.build
LINT := .lint.pass
BUILD := dist/build.json
DOCKER_DB_NAME := vault_db$(shell pwd | sed 's/\//_/g')

export NO_MINIFY ?= 1

packages: $(PACKAGES)
semantic: $(SEMANTIC)
grunt: $(GRUNT)

NPATH := $(shell pwd)/node_modules/.bin
SRC := $(shell find client html images stylesheets server -type f)

########################################################
# Building & cleaning targets
########################################################

ifneq ($(SKIP_PACKAGES),1)
$(PACKAGES): package.json
	npm install
	touch $@
else
$(PACKAGES):
	touch $@
endif

$(SEMANTIC): $(shell find semantic/src -type f)
	cd semantic && $(NPATH)/gulp build
	touch $@

ifneq ($(NODE_ENV),production)
$(LINT): $(SRC)
	$(NPATH)/eslint client server
	touch $@
else
$(LINT):
	touch $@
endif

$(GRUNT): $(PACKAGES) $(SEMANTIC) Gruntfile.js $(SRC) $(LINT) Makefile
	$(NPATH)/grunt default
	touch $@

$(BUILD): $(GRUNT) Makefile
	echo '{"git_commit": "$(or $(SOURCE_VERSION),$(shell git rev-parse HEAD))"}' > $@

clean:
	rm -rf $(PACKAGES) $(SEMANTIC) $(GRUNT) dist

realclean: clean
	rm -rf node_modules components

build: $(BUILD)

lint: $(LINT)

docker-db-run:
	if docker inspect $(DOCKER_DB_NAME) >/dev/null 2>&1; then \
		echo "Starting existing database"; \
		docker start --attach $(DOCKER_DB_NAME); \
	else \
		echo "Creating NEW database"; \
		docker run -p 5432:5432 --name $(DOCKER_DB_NAME) postgres:10; \
	fi

docker-db-clean:
	docker kill $(DOCKER_DB_NAME) 2>/dev/null || exit 0
	docker rm -f $(DOCKER_DB_NAME) 2>/dev/null || exit 0



########################################################
# Runtime-only targets
########################################################
watch:
	$(NPATH)/grunt watch

run: $(BUILD)
	npm start

forcerun:
	npm start
