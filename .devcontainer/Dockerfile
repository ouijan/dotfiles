FROM archlinux:latest
RUN pacman -Syu --noconfirm && \
    pacman -S --noconfirm git nvim tmux zsh base-devel fzf
RUN useradd -m -s /usr/bin/zsh devuser
USER devuser
