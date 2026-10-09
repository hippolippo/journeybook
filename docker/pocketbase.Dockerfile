# syntax=docker/dockerfile:1

# PocketBase backend for Journeybook.
# Build from the repository root:
#   docker build -f docker/pocketbase.Dockerfile -t journeybook-pb .
FROM alpine:3.20 AS fetch

ARG PB_VERSION=0.40.5
ARG TARGETARCH
RUN apk add --no-cache curl unzip \
  && curl -fsSL -o /tmp/pb.zip \
    "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip" \
  && unzip -q /tmp/pb.zip -d /pb \
  && rm /tmp/pb.zip

FROM alpine:3.20

RUN apk add --no-cache ca-certificates
WORKDIR /pb

COPY --from=fetch /pb/pocketbase /pb/pocketbase
COPY server/pb_migrations /pb/pb_migrations

VOLUME /pb/pb_data
EXPOSE 8090

ENTRYPOINT ["/pb/pocketbase"]
CMD ["serve", "--http=0.0.0.0:8090", "--dir=/pb/pb_data", "--migrationsDir=/pb/pb_migrations"]
