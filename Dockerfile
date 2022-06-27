FROM jekyll/jekyll:3.7

COPY --chown=jekyll:jekyll Gemfile .
COPY --chown=jekyll:jekyll Gemfile.lock .

RUN bundle install --quiet --clean

CMD ["jekyll", "serve"]