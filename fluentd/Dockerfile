FROM fluent/fluentd:v1.16-1 # Or desired base image
USER root
RUN fluent-gem install fluent-plugin-influxdb     && rm -rf /tmp/* /var/tmp/* /usr/lib/ruby/gems/*/cache/*.gem
USER fluent
